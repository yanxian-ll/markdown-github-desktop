use keyring::{Entry, Error as KeyringError};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{HashSet, VecDeque},
    env,
    fs,
    path::{Component, Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Manager};

const SERVICE_NAME: &str = "com.markdownlatexgit.desktop";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitWorkspace {
    owner: String,
    repo: String,
    branch: String,
    local_dir: String,
    root_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileNode {
    name: String,
    path: String,
    kind: String,
    document_kind: String,
    children: Vec<FileNode>,
}

#[derive(Debug, Clone, Serialize)]
struct GitStatusEntry {
    code: String,
    path: String,
}

#[derive(Debug, Clone, Serialize)]
struct LatexDiagnostic {
    level: String,
    message: String,
    file: Option<String>,
    line: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LatexBuildResult {
    ok: bool,
    command: String,
    pdf_path: Option<String>,
    log: String,
    diagnostics: Vec<LatexDiagnostic>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PdfSyncPoint {
    page: u32,
    x: f64,
    y: f64,
    h: Option<f64>,
    v: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
    pdf_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TexSourcePoint {
    input: String,
    relative_path: Option<String>,
    line: u32,
    column: Option<u32>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ToolPathOverrides {
    pandoc: Option<String>,
    xelatex: Option<String>,
    latexmk: Option<String>,
    synctex: Option<String>,
    git: Option<String>,
}


#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PandocExportProfile {
    id: Option<String>,
    name: Option<String>,
    format: Option<String>,
    args: Option<Vec<String>>,
    output_dir: Option<String>,
    csl: Option<String>,
    bibliography: Option<String>,
    reference_doc: Option<String>,
    resource_paths: Option<Vec<String>>,
    citeproc: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishProfile {
    id: String,
    name: String,
    engine: String,
    content_dir: String,
    asset_dir: String,
    frontmatter_mode: String,
    resource_strategy: String,
    draft: Option<bool>,
    base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PackageExportResult {
    ok: bool,
    output_dir: String,
    copied_files: Vec<String>,
    skipped_files: Vec<String>,
    manifest_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitSyncResult {
    ok: bool,
    command: String,
    log: String,
    conflicted_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct EnvironmentToolCheck {
    id: String,
    label: String,
    ok: bool,
    required: bool,
    command: String,
    version: Option<String>,
    error: Option<String>,
    install_hint: String,
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法获取应用数据目录：{error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("无法创建应用数据目录：{error}"))?;
    Ok(dir.join("state.json"))
}

#[tauri::command]
fn load_app_state(app: AppHandle) -> Result<Value, String> {
    let path = state_path(&app)?;
    if !path.exists() {
        return Ok(json!({}));
    }
    let content = fs::read_to_string(&path).map_err(|error| format!("无法读取状态文件：{error}"))?;
    serde_json::from_str(&content).map_err(|error| format!("状态文件 JSON 无效：{error}"))
}

#[tauri::command]
fn save_app_state(app: AppHandle, state: Value) -> Result<(), String> {
    let path = state_path(&app)?;
    let content = serde_json::to_string_pretty(&state).map_err(|error| format!("无法序列化状态：{error}"))?;
    // 第二道保险：前端已经会剔除工作区 PDF/图片和超大草稿，这里避免异常状态文件
    // 把应用拖慢到无法启动。5MB 足够保存 UI、草稿和项目元数据。
    if content.len() > 5 * 1024 * 1024 {
        return Err("状态文件超过 5MB，已阻止写入；请检查是否有大文件被误放入 appState。".into());
    }
    fs::write(path, content).map_err(|error| format!("无法写入状态文件：{error}"))
}


#[tauri::command]
fn current_system_username() -> Result<Option<String>, String> {
    let candidates = ["GIT_AUTHOR_NAME", "GIT_COMMITTER_NAME", "USERNAME", "USER", "LOGNAME"];
    for key in candidates {
        if let Ok(value) = env::var(key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Ok(Some(trimmed.to_string()));
            }
        }
    }
    Ok(None)
}

fn cleaned_tool_path(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn tool_program<'a>(id: &str, overrides: &'a ToolPathOverrides) -> String {
    match id {
        "pandoc" => cleaned_tool_path(&overrides.pandoc).unwrap_or_else(|| "pandoc".into()),
        "xelatex" => cleaned_tool_path(&overrides.xelatex).unwrap_or_else(|| "xelatex".into()),
        "latexmk" => cleaned_tool_path(&overrides.latexmk).unwrap_or_else(|| "latexmk".into()),
        "synctex" => cleaned_tool_path(&overrides.synctex).unwrap_or_else(|| "synctex".into()),
        "git" => cleaned_tool_path(&overrides.git).unwrap_or_else(|| "git".into()),
        other => other.into(),
    }
}

fn install_hint(id: &str) -> &'static str {
    match id {
        "pandoc" => "Windows: winget install JohnMacFarlane.Pandoc；macOS: brew install pandoc；Linux: sudo apt install pandoc。",
        "xelatex" => "安装 TeX Live 或 MiKTeX；Windows 可用 install-tl-windows 或 MiKTeX，macOS 可用 MacTeX，Linux 可用 texlive-xetex。",
        "latexmk" => "安装 TeX Live/MiKTeX 完整组件；Linux 常见包为 latexmk，Windows/MacTeX 通常随 TeX Live 提供。",
        "synctex" => "随 TeX Live/MiKTeX 安装。需要构建时启用 -synctex=1 才能双向定位。",
        "git" => "Windows: winget install Git.Git；macOS: xcode-select --install 或 brew install git；Linux: sudo apt install git。",
        _ => "请安装该命令并确保路径在 PATH 中，或在设置中手动填写可执行文件路径。",
    }
}

fn version_args(id: &str) -> Vec<&'static str> {
    match id {
        "synctex" => vec!["--version"],
        _ => vec!["--version"],
    }
}

fn first_version_line(output: &[u8], stderr: &[u8]) -> Option<String> {
    let text = format!("{}{}", String::from_utf8_lossy(output), String::from_utf8_lossy(stderr));
    text.lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(|line| line.chars().take(220).collect())
}

fn check_one_tool(id: &str, label: &str, required: bool, overrides: &ToolPathOverrides) -> EnvironmentToolCheck {
    let command = tool_program(id, overrides);
    let output = Command::new(&command).args(version_args(id)).output();
    match output {
        Ok(output) if output.status.success() => EnvironmentToolCheck {
            id: id.into(),
            label: label.into(),
            ok: true,
            required,
            command,
            version: first_version_line(&output.stdout, &output.stderr),
            error: None,
            install_hint: install_hint(id).into(),
        },
        Ok(output) => EnvironmentToolCheck {
            id: id.into(),
            label: label.into(),
            ok: false,
            required,
            command,
            version: first_version_line(&output.stdout, &output.stderr),
            error: Some(format!("命令返回非零状态：{}", output.status)),
            install_hint: install_hint(id).into(),
        },
        Err(error) => EnvironmentToolCheck {
            id: id.into(),
            label: label.into(),
            ok: false,
            required,
            command,
            version: None,
            error: Some(format!("无法执行：{error}")),
            install_hint: install_hint(id).into(),
        },
    }
}

#[tauri::command]
fn check_environment(tool_paths: Option<ToolPathOverrides>) -> Result<Vec<EnvironmentToolCheck>, String> {
    let overrides = tool_paths.unwrap_or_default();
    Ok(vec![
        check_one_tool("pandoc", "Pandoc", true, &overrides),
        check_one_tool("xelatex", "XeLaTeX", true, &overrides),
        check_one_tool("latexmk", "latexmk", false, &overrides),
        check_one_tool("synctex", "SyncTeX", true, &overrides),
        check_one_tool("git", "Git", true, &overrides),
    ])
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| format!("无法读取文件 {path}：{error}"))
}


#[tauri::command]
fn pick_local_folder() -> Result<Option<String>, String> {
    Ok(rfd::FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
fn pick_local_file() -> Result<Option<String>, String> {
    Ok(rfd::FileDialog::new()
        .add_filter("Supported", &[
            "md", "markdown", "mdown", "mkd", "tex", "ltx", "bib", "txt", "sty", "cls",
            "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "pdf",
        ])
        .add_filter("All", &["*"])
        .pick_file()
        .map(|path| path.to_string_lossy().to_string()))
}


#[tauri::command]
fn save_text_file_with_dialog(default_dir: Option<String>, default_filename: Option<String>, text: String) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(dir) = default_dir.as_deref() {
        dialog = dialog.set_directory(dir);
    }
    if let Some(name) = default_filename.as_deref() {
        dialog = dialog.set_file_name(name);
    }
    dialog = dialog.add_filter("Markdown", &["md", "markdown"]).add_filter("Text", &["txt"]);
    let Some(path) = dialog.save_file() else {
        return Ok(None);
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建导出目录：{error}"))?;
    }
    fs::write(&path, text).map_err(|error| format!("无法写入导出文件 {}：{error}", path.display()))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
fn write_text_file(path: String, text: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建父目录：{error}"))?;
    }
    fs::write(&path, text).map_err(|error| format!("无法写入文件 {path}：{error}"))
}

fn credential_entry(account: &str) -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, account).map_err(|error| format!("无法访问系统凭据存储：{error}"))
}

#[tauri::command]
fn set_secret(account: String, value: String) -> Result<(), String> {
    credential_entry(&account)?
        .set_password(&value)
        .map_err(|error| format!("无法写入系统凭据：{error}"))
}

#[tauri::command]
fn get_secret(account: String) -> Result<Option<String>, String> {
    match credential_entry(&account)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!("无法读取系统凭据：{error}")),
    }
}

#[tauri::command]
fn delete_secret(account: String) -> Result<(), String> {
    match credential_entry(&account)?.delete_password() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(format!("无法删除系统凭据：{error}")),
    }
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    open_path_or_url(&url)
}

fn extension_lower(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn is_image_file(path: &Path) -> bool {
    matches!(extension_lower(path).as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp")
}

fn is_pdf_file(path: &Path) -> bool {
    extension_lower(path) == "pdf"
}

fn document_kind(path: &Path) -> String {
    match extension_lower(path).as_str() {
        "md" | "markdown" | "mdown" | "mkd" => "markdown".into(),
        "tex" | "ltx" => "latex".into(),
        "bib" => "bibtex".into(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" => "image".into(),
        "pdf" => "pdf".into(),
        _ => "text".into(),
    }
}

fn is_supported_file(path: &Path) -> bool {
    matches!(
        extension_lower(path).as_str(),
        // Writing formats
        "md" | "markdown" | "mdown" | "mkd" | "tex" | "ltx" | "bib" | "txt" | "text" | "rst" |
        // LaTeX template/support files copied from journals and conferences
        "sty" | "cls" | "bst" | "bbx" | "cbx" | "cfg" | "def" | "clo" | "ldf" | "ist" | "ins" | "dtx" |
        // Data/config files often shipped with paper projects
        "json" | "yaml" | "yml" | "csv" | "tsv" |
        // Visual assets and generated PDF output
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "pdf" | "eps"
    )
}

fn mime_for_path(path: &Path) -> &'static str {
    match extension_lower(path).as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

fn safe_join(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let relative = relative_path.trim().replace('\\', "/");
    let mut path = PathBuf::from(root);
    for component in Path::new(&relative).components() {
        match component {
            Component::Normal(part) => path.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("路径不能包含 ..、盘符或绝对路径。".into());
            }
        }
    }
    Ok(path)
}

fn normalized_relative(base: &Path, path: &Path) -> String {
    path.strip_prefix(base)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn build_tree(base: &Path, current: &Path) -> Result<Vec<FileNode>, String> {
    let mut nodes = Vec::new();
    let mut entries = fs::read_dir(current)
        .map_err(|error| format!("无法读取目录 {}：{error}", current.display()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("无法读取目录项：{error}"))?;
    entries.sort_by_key(|entry| entry.path());

    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name == ".git" || name == "node_modules" || name == "target" || name.starts_with('.') && name != ".latexmkrc" {
            continue;
        }
        let meta = entry.metadata().map_err(|error| format!("无法读取文件元数据：{error}"))?;
        if meta.is_dir() {
            let children = build_tree(base, &path)?;
            if children.is_empty() {
                nodes.push(FileNode {
                    name,
                    path: normalized_relative(base, &path),
                    kind: "folder".into(),
                    document_kind: "text".into(),
                    children,
                });
            } else {
                nodes.push(FileNode {
                    name,
                    path: normalized_relative(base, &path),
                    kind: "folder".into(),
                    document_kind: "text".into(),
                    children,
                });
            }
        } else if meta.is_file() && is_supported_file(&path) {
            nodes.push(FileNode {
                name,
                path: normalized_relative(base, &path),
                kind: "file".into(),
                document_kind: document_kind(&path),
                children: vec![],
            });
        }
    }
    nodes.sort_by(|a, b| match (a.kind.as_str(), b.kind.as_str()) {
        ("folder", "file") => std::cmp::Ordering::Less,
        ("file", "folder") => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(nodes)
}

#[tauri::command]
fn list_workspace_files(root_dir: String, root_path: String) -> Result<Vec<FileNode>, String> {
    let root = PathBuf::from(root_dir);
    let base = safe_join(&root, &root_path)?;
    if !base.exists() {
        return Ok(vec![]);
    }
    build_tree(&base, &base)
}

#[tauri::command]
fn read_workspace_file(root_dir: String, relative_path: String) -> Result<String, String> {
    let root = PathBuf::from(root_dir);
    let path = safe_join(&root, &relative_path)?;
    fs::read_to_string(&path).map_err(|error| format!("无法读取文件 {}：{error}", path.display()))
}


#[tauri::command]
fn read_workspace_data_url(root_dir: String, current_relative_path: String, asset_src: String) -> Result<String, String> {
    let root = PathBuf::from(root_dir);
    let src = asset_src.trim();
    if src.is_empty() || src.starts_with("http://") || src.starts_with("https://") || src.starts_with("data:") {
        return Err("不是本地图片/PDF 路径。".into());
    }
    let cleaned = src
        .split('#')
        .next()
        .unwrap_or(src)
        .split('?')
        .next()
        .unwrap_or(src)
        .replace("%20", " ")
        .replace('\\', "/");
    let base_dir = Path::new(&current_relative_path)
        .parent()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    let relative = if cleaned.starts_with('/') {
        cleaned.trim_start_matches('/').to_string()
    } else if base_dir.is_empty() {
        cleaned
    } else {
        format!("{base_dir}/{cleaned}")
    };
    let path = safe_join(&root, &relative)?;
    if !path.exists() {
        return Err(format!("图片/PDF 不存在：{}", path.display()));
    }
    if !is_image_file(&path) && !is_pdf_file(&path) {
        return Err(format!("不是支持的图片/PDF 文件：{}", path.display()));
    }
    let bytes = fs::read(&path).map_err(|error| format!("无法读取图片/PDF {}：{error}", path.display()))?;
    Ok(format!("data:{};base64,{}", mime_for_path(&path), encode_base64(&bytes)))
}


#[tauri::command]
fn read_file_data_url(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err(format!("文件不存在：{}", path.display()));
    }
    let bytes = fs::read(&path).map_err(|error| format!("无法读取文件 {}：{error}", path.display()))?;
    Ok(format!("data:{};base64,{}", mime_for_path(&path), encode_base64(&bytes)))
}

fn minimal_pdf_bytes(label: &str) -> Vec<u8> {
    let escaped = label
        .replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)");
    let stream = format!("BT /F1 24 Tf 72 720 Td ({escaped}) Tj ET\n");
    let objects = vec![
        "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".to_string(),
        format!("<< /Length {} >>\nstream\n{}endstream", stream.as_bytes().len(), stream),
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),
    ];
    let mut pdf = String::from("%PDF-1.4\n");
    let mut offsets: Vec<usize> = Vec::new();
    for (index, object) in objects.iter().enumerate() {
        offsets.push(pdf.as_bytes().len());
        pdf.push_str(&format!("{} 0 obj\n{}\nendobj\n", index + 1, object));
    }
    let xref_offset = pdf.as_bytes().len();
    pdf.push_str(&format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1));
    for offset in offsets {
        pdf.push_str(&format!("{:010} 00000 n \n", offset));
    }
    pdf.push_str(&format!(
        "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
        objects.len() + 1,
        xref_offset
    ));
    pdf.into_bytes()
}

fn write_sample_file(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建目录 {}：{error}", parent.display()))?;
    }
    fs::write(path, content).map_err(|error| format!("无法写入示例文件 {}：{error}", path.display()))
}

#[tauri::command]
fn create_sample_workspace(app: AppHandle) -> Result<String, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法获取应用数据目录：{error}"))?
        .join("sample-workspace");
    fs::create_dir_all(&base).map_err(|error| format!("无法创建示例工作区：{error}"))?;

    write_sample_file(&base.join("README.md"), r#"# Scholia Studio 示例工作区

这个工作区用于验证“记录 → 证据 → 论文 → 审阅”的核心流程。

- `paper/main.tex`：可编译的最小 LaTeX 论文示例。
- `paper/paper.md`：Pandoc Markdown 论文示例。
- `paper/sample-review.pdf`：用于测试 PDF 预览和批注入口的示例 PDF。
- `notes/daily/2026-06-06.md`：结构化每日研究记录。
- `notes/weekly/2026-W23.md`：周报示例。
- `research/evidence-index.md`：证据索引示例。
- `.paper-notes/annotations.jsonl`：统一批注/审阅条目示例。
"#)?;

    write_sample_file(&base.join("paper/main.tex"), r#"% !TEX root = main.tex
% !TEX program = xelatex
\documentclass{article}
\usepackage[margin=1in]{geometry}
\usepackage{graphicx}
\usepackage{hyperref}
\usepackage{cite}

\title{Scholia Studio Sample Paper}
\author{Scholia Studio}
\date{\today}

\begin{document}
\maketitle

\section{Introduction}\label{sec:introduction}
This sample shows a minimal paper project with one citation~\cite{knuth1984texbook}.

\section{Method}\label{sec:method}
Record claims in daily notes, promote them into the evidence index, and then cite them in the paper.

\section{Result}\label{sec:result}
Review comments can point back to source lines and PDF pages.

\bibliographystyle{plain}
\bibliography{refs}
\end{document}
"#)?;

    write_sample_file(&base.join("paper/latexmkrc"), r#"# Scholia Studio sample workspace uses XeLaTeX for consistent Unicode handling.
$pdf_mode = 5;
$xelatex = 'xelatex -interaction=nonstopmode -synctex=1 -file-line-error %O %S';
$bibtex_use = 2;
"#)?;

    write_sample_file(&base.join("paper/refs.bib"), r#"@book{knuth1984texbook,
  title = {The TeXbook},
  author = {Knuth, Donald E.},
  year = {1984},
  publisher = {Addison-Wesley}
}
"#)?;

    write_sample_file(&base.join("paper/paper.md"), r#"---
title: Scholia Studio Markdown Sample
author: Scholia Studio
bibliography: refs.bib
---

# Introduction

This Markdown paper can be exported with Pandoc and cites [@knuth1984texbook].

# Evidence

- Claim: local-first research notes reduce context switching.
- Evidence: see `research/evidence-index.md`.
"#)?;

    write_sample_file(&base.join("notes/daily/2026-06-06.md"), r#"---
type: daily-note
date: 2026-06-06
---

# 2026-06-06 每日研究记录

## 工作记录
- 搭建示例工作区，验证 Markdown、LaTeX、PDF 批注入口。

## 可能进入论文的结论
- 本地优先的研究记录可以直接沉淀为论文证据。

## 问题与风险
- 需要检查 LaTeX/Pandoc 依赖是否已安装。

## 明日计划
- 使用证据索引生成论文大纲。
"#)?;

    write_sample_file(&base.join("notes/weekly/2026-W23.md"), r#"---
type: weekly-report
week: 2026-W23
---

# 2026-W23 周报

## 本周完成
- 完成示例项目骨架。

## 证据沉淀
- 示例论文、每日笔记和批注已经互相关联。

## 风险
- 尚未连接真实项目数据。

## 下周计划
- 替换为自己的论文和记录。
"#)?;

    write_sample_file(&base.join("research/evidence-index.md"), r#"# 证据索引

| 结论 | 来源 | 状态 | 可用于论文位置 |
| --- | --- | --- | --- |
| 本地优先研究记录可以沉淀为论文证据 | notes/daily/2026-06-06.md | candidate | Introduction |
"#)?;

    write_sample_file(&base.join("paper/paper-outline.md"), r#"# 论文大纲

## Introduction
- [ ] 引入研究问题。
- [ ] 引用证据索引中的候选结论。

## Method
- [ ] 描述记录、证据、审阅闭环。

## Result
- [ ] 总结示例项目验证结果。
"#)?;

    write_sample_file(&base.join(".paper-notes/annotations.jsonl"), r#"{"id":"sample-ann-1","type":"comment","status":"open","body":"示例源码批注：这里可以转为修改任务。","messages":[{"id":"sample-msg-1","body":"示例源码批注：这里可以转为修改任务。","author":"Scholia","createdAt":"2026-06-06T00:00:00.000Z"}],"tags":["sample"],"documentPath":"paper/main.tex","texAnchor":{"file":"paper/main.tex","line":13,"lineEnd":13,"sourceText":"This sample shows a minimal paper project with one citation~\\cite{knuth1984texbook}."},"anchorConfidence":"stable","createdAt":"2026-06-06T00:00:00.000Z","updatedAt":"2026-06-06T00:00:00.000Z"}
"#)?;

    write_sample_file(&base.join(".paper-notes/project.json"), r#"{
  "projectType": "mixed",
  "mainTexFile": "paper/main.tex",
  "mainMarkdownFile": "paper/paper.md",
  "exportProfile": "pdf",
  "pandocProfileId": "pdf",
  "buildCommand": "auto",
  "pdfRenderQuality": 0.72,
  "researchFlowPaths": {
    "dailyDir": "notes/daily",
    "weeklyDir": "notes/weekly",
    "evidenceIndex": "research/evidence-index.md",
    "paperOutline": "paper/paper-outline.md",
    "reviewSummary": ".paper-notes/review-summary.md"
  }
}
"#)?;

    write_sample_file(&base.join(".paper-notes/export-profiles.json"), r#"[
  { "id": "pdf", "name": "PDF", "format": "pdf", "args": ["--pdf-engine=xelatex"], "description": "Pandoc PDF" },
  { "id": "docx", "name": "Word DOCX", "format": "docx", "args": [], "description": "Word 文档" },
  { "id": "html", "name": "HTML", "format": "html", "args": ["--standalone"], "description": "单文件 HTML" }
]
"#)?;

    fs::write(base.join("paper/sample-review.pdf"), minimal_pdf_bytes("Scholia sample PDF"))
        .map_err(|error| format!("无法写入示例 PDF：{error}"))?;

    Ok(base.to_string_lossy().to_string())
}


fn workspace_annotations_path(root_dir: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(root_dir);
    let dir = safe_join(&root, ".paper-notes")?;
    Ok(dir.join("annotations.jsonl"))
}

#[tauri::command]
fn read_workspace_annotations(root_dir: String) -> Result<String, String> {
    let path = workspace_annotations_path(&root_dir)?;
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(&path).map_err(|error| format!("无法读取批注文件 {}：{error}", path.display()))
}

#[tauri::command]
fn write_workspace_annotations(root_dir: String, content: String) -> Result<(), String> {
    let path = workspace_annotations_path(&root_dir)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建批注目录：{error}"))?;
    }
    fs::write(&path, content).map_err(|error| format!("无法写入批注文件 {}：{error}", path.display()))
}

#[tauri::command]
fn write_workspace_file(root_dir: String, relative_path: String, text: String) -> Result<(), String> {
    let root = PathBuf::from(root_dir);
    let path = safe_join(&root, &relative_path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建父目录：{error}"))?;
    }
    fs::write(&path, text).map_err(|error| format!("无法写入文件 {}：{error}", path.display()))
}

#[tauri::command]
fn create_workspace_file(root_dir: String, relative_path: String, text: String) -> Result<(), String> {
    let root = PathBuf::from(root_dir);
    let path = safe_join(&root, &relative_path)?;
    if path.exists() {
        return Err(format!("文件已存在：{}", path.display()));
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建父目录：{error}"))?;
    }
    fs::write(&path, text).map_err(|error| format!("无法创建文件 {}：{error}", path.display()))
}

#[tauri::command]
fn create_workspace_folder(root_dir: String, relative_path: String) -> Result<(), String> {
    let root = PathBuf::from(root_dir);
    let path = safe_join(&root, &relative_path)?;
    fs::create_dir_all(&path).map_err(|error| format!("无法创建文件夹 {}：{error}", path.display()))
}

#[tauri::command]
fn rename_workspace_item(root_dir: String, old_relative_path: String, new_relative_path: String) -> Result<(), String> {
    let root = PathBuf::from(root_dir);
    let old_path = safe_join(&root, &old_relative_path)?;
    let new_path = safe_join(&root, &new_relative_path)?;
    if !old_path.exists() {
        return Err(format!("原路径不存在：{}", old_path.display()));
    }
    if new_path.exists() {
        return Err(format!("目标路径已存在：{}", new_path.display()));
    }
    if let Some(parent) = new_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建目标父目录：{error}"))?;
    }
    fs::rename(&old_path, &new_path).map_err(|error| format!("无法重命名：{error}"))
}

fn safe_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".into())
}

#[tauri::command]
fn delete_workspace_item(root_dir: String, relative_path: String) -> Result<(), String> {
    let root = PathBuf::from(root_dir);
    let path = safe_join(&root, &relative_path)?;
    if !path.exists() {
        return Err(format!("路径不存在：{}", path.display()));
    }
    let normalized = relative_path.trim().replace('\\', "/").trim_start_matches('/').to_string();
    if normalized.starts_with(".paper-notes/trash/") {
        let meta = fs::metadata(&path).map_err(|error| format!("无法读取路径元数据：{error}"))?;
        return if meta.is_dir() {
            fs::remove_dir_all(&path).map_err(|error| format!("无法删除回收站文件夹 {}：{error}", path.display()))
        } else {
            fs::remove_file(&path).map_err(|error| format!("无法删除回收站文件 {}：{error}", path.display()))
        };
    }
    let trash_relative = format!(".paper-notes/trash/{}/{}", safe_timestamp(), normalized);
    let trash_path = safe_join(&root, &trash_relative)?;
    if let Some(parent) = trash_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建回收站目录：{error}"))?;
    }
    fs::rename(&path, &trash_path).map_err(|error| {
        format!(
            "无法移动到本地回收站 {} → {}：{error}",
            path.display(),
            trash_path.display()
        )
    })
}

fn command_output(mut cmd: Command, label: &str) -> Result<String, String> {
    let output = cmd.output().map_err(|error| format!("无法执行 {label}：{error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() {
        Ok(format!("{stdout}{stderr}"))
    } else {
        Err(format!("{label} 执行失败：\n{stdout}{stderr}"))
    }
}

fn encode_base64(input: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(((input.len() + 2) / 3) * 4);
    let mut i = 0;
    while i < input.len() {
        let b0 = input[i];
        let b1 = if i + 1 < input.len() { input[i + 1] } else { 0 };
        let b2 = if i + 2 < input.len() { input[i + 2] } else { 0 };

        out.push(TABLE[(b0 >> 2) as usize] as char);
        out.push(TABLE[(((b0 & 0b0000_0011) << 4) | (b1 >> 4)) as usize] as char);
        if i + 1 < input.len() {
            out.push(TABLE[(((b1 & 0b0000_1111) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            out.push('=');
        }
        if i + 2 < input.len() {
            out.push(TABLE[(b2 & 0b0011_1111) as usize] as char);
        } else {
            out.push('=');
        }
        i += 3;
    }
    out
}

fn git_with_auth(root: Option<&Path>, token: Option<&str>) -> Command {
    let mut cmd = Command::new("git");
    if let Some(dir) = root {
        cmd.current_dir(dir);
    }
    if let Some(token) = token.filter(|value| !value.trim().is_empty()) {
        // GitHub HTTPS Git 对 private repo 推荐使用 Basic 鉴权：用户名固定为 x-access-token，密码为 PAT。
        // 这里通过临时 http.extraheader 注入，不把 token 写入 remote URL，也不依赖 Git Credential Manager/网页登录。
        let basic = encode_base64(format!("x-access-token:{}", token.trim()).as_bytes());
        cmd.arg("-c").arg(format!("http.https://github.com/.extraheader=Authorization: Basic {basic}"));
        cmd.env("GIT_TERMINAL_PROMPT", "0");
    }
    cmd
}

#[tauri::command]
fn clone_or_update_repository(workspace: GitWorkspace, token: Option<String>) -> Result<String, String> {
    let local_dir = PathBuf::from(workspace.local_dir.trim());
    if workspace.owner.trim().is_empty() || workspace.repo.trim().is_empty() || workspace.branch.trim().is_empty() {
        return Err("Owner、Repo、Branch 不能为空。".into());
    }
    let remote_url = format!("https://github.com/{}/{}.git", workspace.owner.trim(), workspace.repo.trim());
    let token_ref = token.as_deref();

    if local_dir.join(".git").exists() {
        let mut fetch = git_with_auth(Some(&local_dir), token_ref);
        fetch.args(["fetch", "--depth=1", "origin", workspace.branch.trim()]);
        command_output(fetch, "git fetch")?;
        let mut checkout = git_with_auth(Some(&local_dir), token_ref);
        checkout.args(["checkout", workspace.branch.trim()]);
        command_output(checkout, "git checkout")?;
        let mut pull = git_with_auth(Some(&local_dir), token_ref);
        pull.args(["pull", "--ff-only", "origin", workspace.branch.trim()]);
        command_output(pull, "git pull")
    } else {
        if local_dir.exists() && fs::read_dir(&local_dir).map_err(|error| format!("无法检查本地目录：{error}"))?.next().is_some() {
            return Err("本地目录不是空目录，也不是 Git 仓库。请选择空目录或已有 clone。".into());
        }
        if let Some(parent) = local_dir.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("无法创建本地目录父级：{error}"))?;
        }
        let mut clone = git_with_auth(None, token_ref);
        clone
            .arg("clone")
            .arg("--depth=1")
            .arg("--branch")
            .arg(workspace.branch.trim())
            .arg(&remote_url)
            .arg(&local_dir);
        command_output(clone, "git clone --depth=1")
    }
}

#[tauri::command]
fn git_status(root_dir: String) -> Result<Vec<GitStatusEntry>, String> {
    let root = PathBuf::from(root_dir);
    let mut cmd = Command::new("git");
    cmd.current_dir(&root).args(["status", "--porcelain"]);
    let output = command_output(cmd, "git status")?;
    Ok(output
        .lines()
        .filter_map(|line| {
            if line.len() < 4 { return None; }
            Some(GitStatusEntry {
                code: line[..2].trim().to_string(),
                path: line[3..].to_string(),
            })
        })
        .collect())
}

#[tauri::command]
fn commit_and_push(root_dir: String, branch: String, message: String, token: Option<String>) -> Result<String, String> {
    let root = PathBuf::from(root_dir);
    let status = git_status(root.to_string_lossy().to_string())?;
    if status.is_empty() {
        return Ok("没有需要提交的变更。".into());
    }
    let token_ref = token.as_deref();
    let mut add = git_with_auth(Some(&root), token_ref);
    add.args(["add", "-A"]);
    command_output(add, "git add")?;

    let mut commit = git_with_auth(Some(&root), token_ref);
    commit.args(["commit", "-m", message.trim()]);
    let commit_out = command_output(commit, "git commit")?;

    let mut push = git_with_auth(Some(&root), token_ref);
    push.args(["push", "origin", branch.trim()]);
    let push_out = command_output(push, "git push")?;

    Ok(format!("{commit_out}\n{push_out}"))
}

fn normalize_latex_log_path_for_display(root: &Path, work_dir: &Path, raw: &str) -> String {
    let mut cleaned = raw
        .trim()
        .trim_matches(|c| c == '(' || c == ')' || c == '\'' || c == '"')
        .replace('\\', "/");
    while let Some(rest) = cleaned.strip_prefix("./") {
        cleaned = rest.to_string();
    }
    if cleaned.is_empty() {
        return cleaned;
    }
    let raw_path = Path::new(&cleaned);
    let candidate = if raw_path.is_absolute() {
        raw_path.to_path_buf()
    } else {
        work_dir.join(raw_path)
    };
    if let Ok(relative) = candidate.strip_prefix(root) {
        let display = relative.to_string_lossy().replace('\\', "/");
        return display.trim_start_matches("./").to_string();
    }
    cleaned.trim_start_matches("./").to_string()
}

fn extract_latex_file_token(trimmed: &str, suffix: &str) -> Option<String> {
    let idx = trimmed.find(suffix)?;
    let end = idx + suffix.len();
    let start = trimmed[..idx]
        .rfind(|c: char| c == ' ' || c == '(' || c == ')' || c == '\'' || c == '"')
        .map(|i| i + 1)
        .unwrap_or(0);
    Some(trimmed[start..end].trim_matches('(').to_string())
}

fn parse_latex_diagnostics(log: &str, root: &Path, work_dir: &Path) -> Vec<LatexDiagnostic> {
    let mut diagnostics = Vec::new();
    let mut current_file: Option<String> = None;
    let mut pending_error: Option<(String, Option<String>, Option<u32>)> = None;

    for line in log.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if let Some(file_token) = extract_latex_file_token(trimmed, ".tex") {
            current_file = Some(normalize_latex_log_path_for_display(root, work_dir, &file_token));
        }

        // -file-line-error commonly emits: path/file.tex:12: message
        if let Some(tex_idx) = trimmed.find(".tex:") {
            let file_end = tex_idx + 4;
            let rest = &trimmed[file_end + 1..];
            let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
            if let Ok(line_no) = digits.parse::<u32>() {
                let message = rest
                    .trim_start_matches(|c: char| c.is_ascii_digit() || c == ':')
                    .trim()
                    .to_string();
                diagnostics.push(LatexDiagnostic {
                    level: if message.to_ascii_lowercase().contains("warning") { "warning" } else { "error" }.into(),
                    message: if message.is_empty() { trimmed.to_string() } else { message },
                    file: Some(normalize_latex_log_path_for_display(root, work_dir, &trimmed[..file_end])),
                    line: Some(line_no),
                });
                continue;
            }
        }

        if let Some(rest) = trimmed.strip_prefix('!') {
            pending_error = Some((rest.trim().to_string(), current_file.clone(), None));
            diagnostics.push(LatexDiagnostic {
                level: "error".into(),
                message: actionable_latex_message(rest.trim()),
                file: current_file.clone(),
                line: None,
            });
            continue;
        }

        if let Some(line_no) = trimmed
            .strip_prefix("l.")
            .and_then(|value| value.split_whitespace().next())
            .and_then(|value| value.parse::<u32>().ok())
        {
            if let Some((message, file, _)) = pending_error.take() {
                if let Some(last) = diagnostics.last_mut() {
                    if last.level == "error" && last.line.is_none() {
                        last.file = file;
                        last.line = Some(line_no);
                        last.message = actionable_latex_message(&message);
                        continue;
                    }
                }
            }
        }

        let lower = trimmed.to_ascii_lowercase();
        if lower.contains("undefined control sequence")
            || lower.contains("file `") && lower.contains("' not found")
            || lower.contains("emergency stop")
            || lower.contains("fatal error")
            || lower.contains("previous invocation of latexmk")
            || lower.contains("gave an error in previous invocation")
            || lower.contains(": error:")
        {
            diagnostics.push(LatexDiagnostic {
                level: "error".into(),
                message: actionable_latex_message(trimmed),
                file: current_file.clone(),
                line: None,
            });
        } else if lower.contains("latex warning:")
            || lower.contains("package ") && lower.contains(" warning:")
            || lower.contains("citation `") && lower.contains("undefined")
            || lower.contains("reference `") && lower.contains("undefined")
            || lower.contains("undefined references")
            || lower.contains("undefined citations")
            || lower.contains("overfull \\hbox")
            || lower.contains("underfull \\hbox")
            || lower.contains("font warning")
        {
            diagnostics.push(LatexDiagnostic {
                level: "warning".into(),
                message: actionable_latex_message(trimmed),
                file: current_file.clone(),
                line: None,
            });
        }
    }

    diagnostics
}

fn actionable_latex_message(message: &str) -> String {
    let lower = message.to_ascii_lowercase();
    if lower.contains("undefined control sequence") {
        format!("{message}｜可能缺少宏包或命令拼写错误；检查导言区 \\usepackage 和自定义命令。")
    } else if lower.contains("citation `") && lower.contains("undefined") {
        format!("{message}｜引用未定义；检查 refs.bib 是否包含该 key，并重新运行 BibTeX/Biber/latexmk。")
    } else if lower.contains("reference `") && lower.contains("undefined") || lower.contains("undefined references") {
        format!("{message}｜交叉引用未解析；检查 \\label 名称并至少重新编译两次。")
    } else if lower.contains("file `") && lower.contains("' not found") {
        format!("{message}｜文件缺失；检查图片/cls/sty/bib 路径、模板 vendor 文件是否完整。")
    } else if lower.contains("font") && (lower.contains("not found") || lower.contains("warning")) {
        format!("{message}｜字体相关问题；XeLaTeX 项目请确认系统已安装模板要求字体。")
    } else if lower.contains("previous invocation of latexmk") || lower.contains("gave an error in previous invocation") {
        format!("{message}｜latexmk 记录了上一次失败状态；请清理辅助文件后重建，或使用应用内‘清理辅助文件’快捷键 Ctrl/Cmd+Alt+K。")
    } else if lower.contains("pdflatex") && (lower.contains("ctex") || lower.contains("fontspec") || lower.contains("xelatex")) {
        format!("{message}｜当前可能用了 pdfLaTeX；含中文/CTeX/fontspec 的模板应使用 XeLaTeX。")
    } else if lower.contains("overfull \\hbox") {
        format!("{message}｜排版溢出；可检查长公式、长 URL、表格宽度或手动断行。")
    } else {
        message.to_string()
    }
}

fn run_latex_command(work_dir: &Path, program: &str, args: &[&str]) -> Result<(bool, String), String> {
    let output = Command::new(program)
        .current_dir(work_dir)
        .args(args)
        .output()
        .map_err(|error| format!("无法执行 {program}：{error}"))?;
    Ok((
        output.status.success(),
        format!("$ {program} {}\n{}{}\n", args.join(" "), String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr)),
    ))
}

fn read_tex_root(tex_path: &Path) -> PathBuf {
    let content = fs::read_to_string(tex_path).unwrap_or_default();
    for line in content.lines().take(60) {
        let lower = line.to_ascii_lowercase();
        if lower.contains("!tex root") || lower.contains("tex root") {
            if let Some((_, value)) = line.split_once('=') {
                let root = value.trim().trim_matches(|c| c == '%' || c == ' ' || c == '\t');
                if !root.is_empty() {
                    if let Some(parent) = tex_path.parent() {
                        return parent.join(root);
                    }
                }
            }
        }
    }
    tex_path.to_path_buf()
}

fn normalize_latex_engine(value: &str) -> Option<&'static str> {
    let normalized = value
        .trim()
        .trim_matches(|c| c == '%' || c == ' ' || c == '\t')
        .to_ascii_lowercase()
        .replace('-', "");
    if normalized.contains("xelatex") || normalized.contains("xetex") {
        Some("xelatex")
    } else if normalized.contains("lualatex") || normalized.contains("luatex") {
        Some("lualatex")
    } else if normalized.contains("pdflatex") {
        Some("pdflatex")
    } else {
        None
    }
}

fn latex_requires_xelatex(content: &str) -> bool {
    let lower = content.to_ascii_lowercase();
    lower.contains("{csuthesis}")
        || lower.contains("\\usepackage{ctex}")
        || lower.contains("\\usepackage[utf8]{ctex}")
        || lower.contains("\\documentclass{ctex")
        || lower.contains("\\documentclass[") && lower.contains("]{ctex")
        || lower.contains("\\usepackage{fontspec}")
        || lower.contains("\\usepackage{xecjk}")
        || lower.contains("\\setmainfont")
        || lower.contains("\\setsansfont")
        || lower.contains("\\setmonofont")
        || lower.contains("\\setcjkmainfont")
        || lower.contains("\\setcjksansfont")
        || lower.contains("\\setcjkmonofont")
}

fn read_tex_program(tex_path: &Path) -> &'static str {
    let content = fs::read_to_string(tex_path).unwrap_or_default();
    for line in content.lines().take(60) {
        let lower = line.to_ascii_lowercase();
        if (lower.contains("!tex") || lower.contains("ts-program"))
            && (lower.contains("program") || lower.contains("ts-program"))
        {
            if let Some((_, value)) = line.split_once('=') {
                if let Some(engine) = normalize_latex_engine(value) {
                    return engine;
                }
            }
        }
    }
    if latex_requires_xelatex(&content) {
        return "xelatex";
    }
    "pdflatex"
}

fn latexmk_mode_arg(engine: &str) -> &'static str {
    match engine {
        "xelatex" => "-xelatex",
        "lualatex" => "-lualatex",
        _ => "-pdf",
    }
}

fn tex_uses_bibliography(tex_path: &Path) -> bool {
    let content = fs::read_to_string(tex_path).unwrap_or_default();
    content.contains("\\bibliography{") || content.contains("\\addbibresource{") || content.contains("\\printbibliography")
}

fn latexmk_previous_invocation_error(log: &str) -> bool {
    let lower = log.to_ascii_lowercase();
    lower.contains("gave an error in previous invocation of latexmk")
        || lower.contains("previous invocation of latexmk")
        || lower.contains("all targets") && lower.contains("up-to-date") && lower.contains("gave an error")
}

fn clean_latex_artifacts_for_tex(tex_path: &Path) -> Result<usize, String> {
    let work_dir = tex_path.parent().ok_or_else(|| "无法获取 LaTeX 文件目录。".to_string())?;
    let stem = tex_path.file_stem().and_then(|v| v.to_str()).ok_or_else(|| "LaTeX 文件名无效。".to_string())?;
    let exts = [
        "aux", "bbl", "bcf", "blg", "fdb_latexmk", "fls", "log", "out", "run.xml",
        "synctex.gz", "toc", "lof", "lot", "idx", "ilg", "ind", "nav", "snm", "vrb", "xdv",
    ];
    let mut removed = 0;
    for ext in exts {
        let path = work_dir.join(format!("{stem}.{ext}"));
        if path.exists() {
            fs::remove_file(&path).map_err(|error| format!("无法删除 {}：{error}", path.display()))?;
            removed += 1;
        }
    }
    Ok(removed)
}

#[tauri::command]
fn find_latex_pdf(root_dir: String, relative_path: String) -> Result<Option<String>, String> {
    let root = PathBuf::from(root_dir);
    let requested_tex_path = safe_join(&root, &relative_path)?;
    if !requested_tex_path.exists() {
        return Ok(None);
    }
    let tex_path = read_tex_root(&requested_tex_path);
    let pdf_path = tex_path.with_extension("pdf");
    Ok(pdf_path.exists().then(|| pdf_path.to_string_lossy().to_string()))
}

fn parse_pandoc_diagnostics(log: &str, relative_path: &str) -> Vec<LatexDiagnostic> {
    let mut diagnostics = Vec::new();
    for line in log.lines() {
        let lower = line.to_ascii_lowercase();
        let level = if lower.contains("error") || lower.contains("failed") {
            Some("error")
        } else if lower.contains("warning") || lower.contains("[warning]") {
            Some("warning")
        } else {
            None
        };
        let Some(level) = level else { continue; };
        let mut parsed_line: Option<u32> = None;
        if let Some(index) = line.find(relative_path) {
            let rest = &line[index + relative_path.len()..];
            if let Some(rest) = rest.strip_prefix(':') {
                let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
                parsed_line = digits.parse::<u32>().ok();
            }
        }
        diagnostics.push(LatexDiagnostic {
            level: level.into(),
            message: line.trim().to_string(),
            file: Some(relative_path.to_string()),
            line: parsed_line,
        });
    }
    diagnostics
}

fn parse_simple_attrs_and_body(content: &str) -> (std::collections::BTreeMap<String, String>, String) {
    let mut attrs = std::collections::BTreeMap::new();
    let normalized = content.replace("\r\n", "\n");
    let lines: Vec<&str> = normalized.lines().collect();
    let mut index = 0usize;
    while index < lines.len() {
        let line = lines[index].trim();
        if line.is_empty() { index += 1; continue; }
        if line.chars().all(|c| c == '-') && line.len() >= 3 {
            index += 1;
            break;
        }
        let Some((key, value)) = line.split_once(':') else { break; };
        let key = key.trim().to_ascii_lowercase();
        if key.is_empty() || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') { break; }
        attrs.insert(key, value.trim().to_string());
        index += 1;
    }
    (attrs, lines[index..].join("\n").trim().to_string())
}

fn latex_escape_text(value: &str) -> String {
    value
        .replace('\\', "\\textbackslash{}")
        .replace('&', "\\&")
        .replace('%', "\\%")
        .replace('$', "\\$")
        .replace('#', "\\#")
        .replace('_', "\\_")
        .replace('{', "\\{")
        .replace('}', "\\}")
}

fn markdown_fence_to_latex(kind: &str, content: &str) -> String {
    let (attrs, body) = parse_simple_attrs_and_body(content);
    let caption = attrs.get("caption").or_else(|| attrs.get("title")).cloned().unwrap_or_default();
    let label = attrs.get("label").cloned().unwrap_or_default();
    match kind {
        "figure" => {
            let src = attrs.get("src").or_else(|| attrs.get("image")).or_else(|| attrs.get("path")).cloned().unwrap_or_else(|| body.lines().next().unwrap_or_default().trim().to_string());
            let width = attrs.get("width").cloned().unwrap_or_else(|| "0.9\\linewidth".to_string());
            let placement = attrs.get("placement").cloned().unwrap_or_else(|| "htbp".to_string());
            format!("\\begin{{figure}}[{placement}]\n\\centering\n{}\n{}{}\\end{{figure}}\n",
                if src.is_empty() { "% figure src missing".to_string() } else { format!("\\includegraphics[width={width}]{{{src}}}") },
                if caption.is_empty() { String::new() } else { format!("\\caption{{{}}}\n", latex_escape_text(&caption)) },
                if label.is_empty() { String::new() } else { format!("\\label{{{label}}}\n") },
            )
        }
        "table" => {
            let placement = attrs.get("placement").cloned().unwrap_or_else(|| "htbp".to_string());
            format!("\\begin{{table}}[{placement}]\n\\centering\n{}{}{}\\end{{table}}\n",
                if caption.is_empty() { String::new() } else { format!("\\caption{{{}}}\n", latex_escape_text(&caption)) },
                if label.is_empty() { String::new() } else { format!("\\label{{{label}}}\n") },
                if body.is_empty() { "% table body missing\n".to_string() } else { format!("{}\n", body) },
            )
        }
        "algorithm" => {
            format!("\\begin{{algorithm}}\n{}{}\\begin{{verbatim}}\n{}\n\\end{{verbatim}}\n\\end{{algorithm}}\n",
                if caption.is_empty() { String::new() } else { format!("\\caption{{{}}}\n", latex_escape_text(&caption)) },
                if label.is_empty() { String::new() } else { format!("\\label{{{label}}}\n") },
                body,
            )
        }
        "theorem" => {
            let env = attrs.get("env").cloned().unwrap_or_else(|| "theorem".to_string());
            format!("\\begin{{{env}}}{}\n{}{}\\end{{{env}}}\n",
                if caption.is_empty() { String::new() } else { format!("[{}]", latex_escape_text(&caption)) },
                if label.is_empty() { String::new() } else { format!("\\label{{{label}}}\n") },
                body,
            )
        }
        _ => content.to_string(),
    }
}

fn preprocess_markdown_latex_blocks(markdown: &str) -> String {
    let mut out = String::new();
    let lines: Vec<&str> = markdown.lines().collect();
    let mut index = 0usize;
    while index < lines.len() {
        let trimmed = lines[index].trim();
        let fence_kind = if trimmed.starts_with("```") {
            let info = trimmed.trim_start_matches('`').trim().to_ascii_lowercase();
            match info.as_str() {
                "figure" | "latex-figure" => Some("figure"),
                "table" | "latex-table" => Some("table"),
                "algorithm" | "latex-algorithm" => Some("algorithm"),
                "theorem" | "latex-theorem" => Some("theorem"),
                _ => None,
            }
        } else { None };
        if let Some(kind) = fence_kind {
            index += 1;
            let mut content = Vec::new();
            while index < lines.len() && !lines[index].trim().starts_with("```") {
                content.push(lines[index]);
                index += 1;
            }
            if index < lines.len() { index += 1; }
            out.push_str("\n```{=latex}\n");
            out.push_str(&markdown_fence_to_latex(kind, &content.join("\n")));
            out.push_str("```\n\n");
        } else {
            out.push_str(lines[index]);
            out.push('\n');
            index += 1;
        }
    }
    out
}

fn build_markdown_pandoc_blocking(root_dir: String, relative_path: String, tool_paths: Option<ToolPathOverrides>) -> Result<LatexBuildResult, String> {
    let root = PathBuf::from(root_dir);
    let md_path = safe_join(&root, &relative_path)?;
    if !md_path.exists() {
        return Err(format!("Markdown 文件不存在：{}", md_path.display()));
    }
    let work_dir = md_path.parent().ok_or_else(|| "无法获取 Markdown 文件目录。".to_string())?;
    let file_name = md_path.file_name().and_then(|v| v.to_str()).ok_or_else(|| "Markdown 文件名无效。".to_string())?;
    let stem = md_path.file_stem().and_then(|v| v.to_str()).ok_or_else(|| "Markdown 文件名无效。".to_string())?;
    let source = fs::read_to_string(&md_path).map_err(|error| format!("无法读取 Markdown 文件：{error}"))?;
    let build_dir = root.join(".paper-notes").join("pandoc-build");
    fs::create_dir_all(&build_dir).map_err(|error| format!("无法创建 Pandoc 构建目录：{error}"))?;
    let temp_name = format!("{stem}.pandoc.md");
    let temp_path = build_dir.join(&temp_name);
    fs::write(&temp_path, preprocess_markdown_latex_blocks(&source)).map_err(|error| format!("无法写入 Pandoc 临时文件：{error}"))?;
    let pdf_path = md_path.with_extension("pdf");
    let overrides = tool_paths.unwrap_or_default();
    let pandoc = tool_program("pandoc", &overrides);
    let xelatex = tool_program("xelatex", &overrides);
    let mut cmd = Command::new(&pandoc);
    cmd.current_dir(work_dir)
        .arg(&temp_path)
        .args(["--from", "markdown+tex_math_dollars+raw_tex+yaml_metadata_block+fenced_divs"])
        .arg("--standalone")
        .arg(format!("--pdf-engine={xelatex}"))
        .arg("-o")
        .arg(&pdf_path);
    let output = cmd.output().map_err(|error| format!("无法执行 pandoc。请先安装 Pandoc 并配置 PATH：{error}"))?;
    let log = format!("$ {} {file_name} --pdf-engine={} -o {}\n{}{}", pandoc, xelatex, pdf_path.display(), String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
    Ok(LatexBuildResult {
        ok: output.status.success() && pdf_path.exists(),
        command: format!("{} {file_name} --pdf-engine={}", pandoc, xelatex),
        pdf_path: pdf_path.exists().then(|| pdf_path.to_string_lossy().to_string()),
        diagnostics: parse_pandoc_diagnostics(&log, &relative_path),
        log,
    })
}

#[tauri::command]
async fn build_markdown_pandoc(root_dir: String, relative_path: String, tool_paths: Option<ToolPathOverrides>) -> Result<LatexBuildResult, String> {
    tauri::async_runtime::spawn_blocking(move || build_markdown_pandoc_blocking(root_dir, relative_path, tool_paths))
        .await
        .map_err(|error| format!("Pandoc 后台任务失败：{error}"))?
}


fn pandoc_output_extension(format: &str) -> Result<&'static str, String> {
    match format {
        "pdf" | "beamer" => Ok("pdf"),
        "docx" => Ok("docx"),
        "html" => Ok("html"),
        "epub" => Ok("epub"),
        "latex" | "tex" => Ok("tex"),
        other => Err(format!("不支持的导出格式：{other}")),
    }
}

fn export_markdown_pandoc_blocking(root_dir: String, relative_path: String, format: String, tool_paths: Option<ToolPathOverrides>, profile: Option<PandocExportProfile>) -> Result<LatexBuildResult, String> {
    let root = PathBuf::from(root_dir);
    let md_path = safe_join(&root, &relative_path)?;
    if !md_path.exists() {
        return Err(format!("Markdown 文件不存在：{}", md_path.display()));
    }
    let work_dir = md_path.parent().ok_or_else(|| "无法获取 Markdown 文件目录。".to_string())?;
    let stem = md_path.file_stem().and_then(|v| v.to_str()).ok_or_else(|| "Markdown 文件名无效。".to_string())?;
    let source = fs::read_to_string(&md_path).map_err(|error| format!("无法读取 Markdown 文件：{error}"))?;
    let build_dir = root.join(".paper-notes").join("pandoc-build");
    fs::create_dir_all(&build_dir).map_err(|error| format!("无法创建 Pandoc 构建目录：{error}"))?;
    let temp_path = build_dir.join(format!("{stem}.export.md"));
    fs::write(&temp_path, preprocess_markdown_latex_blocks(&source)).map_err(|error| format!("无法写入 Pandoc 临时文件：{error}"))?;
    let profile = profile.unwrap_or_default();
    let ext = pandoc_output_extension(&format)?;
    let default_name = format!("{stem}.{ext}");
    let output_dir = profile.output_dir.as_deref().filter(|value| !value.trim().is_empty()).map(|value| safe_join(&root, value)).transpose()?.unwrap_or_else(|| work_dir.to_path_buf());
    let Some(output_path) = rfd::FileDialog::new()
        .set_directory(output_dir)
        .set_file_name(&default_name)
        .save_file() else {
            return Ok(LatexBuildResult { ok: false, command: "pandoc export canceled".into(), pdf_path: None, log: "已取消导出。".into(), diagnostics: vec![] });
        };
    let overrides = tool_paths.unwrap_or_default();
    let pandoc = tool_program("pandoc", &overrides);
    let xelatex = tool_program("xelatex", &overrides);
    let mut cmd = Command::new(&pandoc);
    cmd.current_dir(work_dir)
        .arg(&temp_path)
        .args(["--from", "markdown+tex_math_dollars+raw_tex+yaml_metadata_block+fenced_divs"])
        .arg("--standalone");
    if format == "pdf" {
        cmd.arg(format!("--pdf-engine={xelatex}"));
    } else if format == "beamer" {
        cmd.args(["-t", "beamer"]).arg(format!("--pdf-engine={xelatex}"));
    } else if format == "latex" || format == "tex" {
        cmd.args(["-t", "latex"]);
    }
    if profile.citeproc.unwrap_or(false) || profile.bibliography.as_deref().map(|value| !value.trim().is_empty()).unwrap_or(false) {
        cmd.arg("--citeproc");
    }
    if let Some(bibliography) = profile.bibliography.as_deref().filter(|value| !value.trim().is_empty()) {
        cmd.arg(format!("--bibliography={bibliography}"));
    }
    if let Some(csl) = profile.csl.as_deref().filter(|value| !value.trim().is_empty()) {
        cmd.arg(format!("--csl={csl}"));
    }
    if let Some(reference_doc) = profile.reference_doc.as_deref().filter(|value| !value.trim().is_empty()) {
        cmd.arg(format!("--reference-doc={reference_doc}"));
    }
    for resource_path in profile.resource_paths.unwrap_or_default().into_iter().filter(|value| !value.trim().is_empty()) {
        cmd.arg(format!("--resource-path={resource_path}"));
    }
    for arg in profile.args.unwrap_or_default().into_iter().filter(|value| !value.trim().is_empty()) {
        if format == "beamer" && arg == "-t" { continue; }
        if format == "beamer" && arg == "beamer" { continue; }
        cmd.arg(arg);
    }
    cmd.arg("-o").arg(&output_path);
    let output = cmd.output().map_err(|error| format!("无法执行 pandoc。请先安装 Pandoc 并配置 PATH：{error}"))?;
    let log = format!("$ {} {} -o {}\n{}{}", pandoc, md_path.display(), output_path.display(), String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
    Ok(LatexBuildResult {
        ok: output.status.success() && output_path.exists(),
        command: format!("{} export {format}", pandoc),
        pdf_path: output_path.exists().then(|| output_path.to_string_lossy().to_string()),
        diagnostics: parse_pandoc_diagnostics(&log, &relative_path),
        log,
    })
}

#[tauri::command]
async fn export_markdown_pandoc(root_dir: String, relative_path: String, format: String, tool_paths: Option<ToolPathOverrides>, profile: Option<PandocExportProfile>) -> Result<LatexBuildResult, String> {
    tauri::async_runtime::spawn_blocking(move || export_markdown_pandoc_blocking(root_dir, relative_path, format, tool_paths, profile))
        .await
        .map_err(|error| format!("Pandoc 导出后台任务失败：{error}"))?
}


fn slugify(value: &str) -> String {
    let mut out = String::new();
    let mut last_dash = false;
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    out.trim_matches('-').to_string().chars().take(80).collect::<String>()
}

fn strip_yaml_frontmatter(markdown: &str) -> String {
    let normalized = markdown.replace("\r\n", "\n");
    let mut lines = normalized.lines();
    if lines.next().map(str::trim) != Some("---") {
        return markdown.to_string();
    }
    let mut body_started = false;
    let mut body = Vec::new();
    for line in lines {
        if !body_started && line.trim() == "---" {
            body_started = true;
            continue;
        }
        if body_started {
            body.push(line);
        }
    }
    if body_started { body.join("\n").trim_start().to_string() } else { markdown.to_string() }
}

fn markdown_title(markdown: &str, fallback: &str) -> String {
    markdown.lines()
        .find_map(|line| line.trim().strip_prefix("# ").map(|value| value.trim().to_string()))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn extract_markdown_image_targets(markdown: &str) -> Vec<String> {
    let mut targets = Vec::new();
    let bytes = markdown.as_bytes();
    let mut index = 0usize;
    while index + 3 < bytes.len() {
        if bytes[index] == b'!' && bytes[index + 1] == b'[' {
            if let Some(close_bracket) = markdown[index + 2..].find("](") {
                let start = index + 2 + close_bracket + 2;
                if let Some(close_paren) = markdown[start..].find(')') {
                    let raw = markdown[start..start + close_paren].trim();
                    let cleaned = raw.split_whitespace().next().unwrap_or(raw).trim_matches('"').trim_matches('\'');
                    if !cleaned.is_empty() && !cleaned.starts_with("http://") && !cleaned.starts_with("https://") && !cleaned.starts_with("data:") {
                        targets.push(cleaned.to_string());
                    }
                    index = start + close_paren + 1;
                    continue;
                }
            }
        }
        index += 1;
    }
    targets.sort();
    targets.dedup();
    targets
}

fn workspace_asset_relative(current_relative_path: &str, asset_src: &str) -> String {
    let cleaned = asset_src
        .split('#').next().unwrap_or(asset_src)
        .split('?').next().unwrap_or(asset_src)
        .replace("%20", " ")
        .replace('\\', "/");
    if cleaned.starts_with('/') {
        cleaned.trim_start_matches('/').to_string()
    } else {
        let base = Path::new(current_relative_path).parent().and_then(|value| value.to_str()).unwrap_or("").replace('\\', "/");
        if base.is_empty() { cleaned } else { format!("{base}/{cleaned}") }
    }
}

fn public_asset_path(asset_dir: &str, file_name: &str) -> String {
    let normalized = asset_dir.replace('\\', "/");
    if let Some((_, tail)) = normalized.split_once("static/") {
        format!("/{}/{}", tail.trim_matches('/'), file_name)
    } else {
        let last = normalized.split('/').filter(|part| !part.is_empty()).last().unwrap_or("assets");
        format!("/{last}/{file_name}")
    }
}

fn write_package_manifest(output_dir: &Path, title: &str, copied: &[String], skipped: &[String], notes: &[String]) -> Result<String, String> {
    let manifest_path = output_dir.join("README.md");
    let mut lines = vec![
        format!("# {title}"),
        String::new(),
        format!("- Generated by Scholia Studio at UNIX timestamp `{}`.", safe_timestamp()),
        format!("- Copied files: {}", copied.len()),
        format!("- Skipped files: {}", skipped.len()),
        String::new(),
    ];
    if !notes.is_empty() {
        lines.push("## Notes".into());
        lines.push(String::new());
        lines.extend(notes.iter().map(|item| format!("- {item}")));
        lines.push(String::new());
    }
    lines.push("## Copied files".into());
    lines.push(String::new());
    if copied.is_empty() { lines.push("- None".into()); } else { lines.extend(copied.iter().map(|item| format!("- `{item}`"))); }
    lines.push(String::new());
    lines.push("## Skipped files".into());
    lines.push(String::new());
    if skipped.is_empty() { lines.push("- None".into()); } else { lines.extend(skipped.iter().map(|item| format!("- `{item}`"))); }
    fs::create_dir_all(output_dir).map_err(|error| format!("无法创建导出目录：{error}"))?;
    fs::write(&manifest_path, lines.join("\n")).map_err(|error| format!("无法写入 manifest：{error}"))?;
    Ok(manifest_path.to_string_lossy().to_string())
}

fn copy_relative_file(root: &Path, relative: &str, output_dir: &Path, copied: &mut Vec<String>, skipped: &mut Vec<String>) {
    let normalized = relative.trim().replace('\\', "/").trim_start_matches('/').to_string();
    if normalized.is_empty() { return; }
    let Ok(source) = safe_join(root, &normalized) else { skipped.push(normalized); return; };
    if !source.is_file() { skipped.push(normalized); return; }
    let target = output_dir.join(&normalized);
    if let Some(parent) = target.parent() {
        if let Err(error) = fs::create_dir_all(parent) {
            skipped.push(format!("{normalized} ({error})"));
            return;
        }
    }
    match fs::copy(&source, &target) {
        Ok(_) => copied.push(normalized),
        Err(error) => skipped.push(format!("{normalized} ({error})")),
    }
}

fn collect_package_files(base: &Path, root: &Path, out: &mut Vec<String>) -> Result<(), String> {
    let entries = fs::read_dir(base).map_err(|error| format!("无法读取目录 {}：{error}", base.display()))?;
    for entry in entries {
        let entry = entry.map_err(|error| format!("无法读取目录项：{error}"))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let relative = normalized_relative(root, &path);
        if name == ".git" || name == "node_modules" || name == "target" { continue; }
        if relative.starts_with(".paper-notes/trash/")
            || relative.starts_with(".paper-notes/backups/")
            || relative.starts_with(".paper-notes/snapshots/")
            || relative.starts_with(".paper-notes/submission-packages/")
            || relative.starts_with(".paper-notes/shared-review-packages/")
            || relative.starts_with("publication/") {
            continue;
        }
        let meta = entry.metadata().map_err(|error| format!("无法读取元数据：{error}"))?;
        if meta.is_dir() {
            collect_package_files(&path, root, out)?;
        } else if meta.is_file() {
            let ext = extension_lower(&path);
            if matches!(ext.as_str(), "tex" | "ltx" | "bib" | "cls" | "sty" | "bst" | "bbx" | "cbx" | "cfg" | "def" | "clo" | "ldf" | "ist" | "ins" | "dtx" | "md" | "markdown" | "png" | "jpg" | "jpeg" | "pdf" | "eps" | "svg") {
                out.push(relative);
            }
        }
    }
    Ok(())
}

fn normalize_latex_path(value: &str) -> Option<String> {
    let mut cleaned = value
        .trim()
        .trim_matches('{')
        .trim_matches('}')
        .trim_matches('"')
        .trim_matches('\'')
        .replace("\\", "/")
        .replace("%20", " ");
    if let Some((head, _)) = cleaned.split_once('#') {
        cleaned = head.to_string();
    }
    if let Some((head, _)) = cleaned.split_once('?') {
        cleaned = head.to_string();
    }
    let cleaned = cleaned.trim().to_string();
    if cleaned.is_empty()
        || cleaned.starts_with("http://")
        || cleaned.starts_with("https://")
        || cleaned.starts_with("data:")
        || cleaned.starts_with("mailto:")
        || cleaned.contains("$") {
        None
    } else {
        Some(cleaned)
    }
}

fn strip_latex_comments(source: &str) -> String {
    let mut out = String::with_capacity(source.len());
    for line in source.replace("\r\n", "\n").lines() {
        let mut previous_backslashes = 0usize;
        for ch in line.chars() {
            if ch == '%' && previous_backslashes % 2 == 0 {
                break;
            }
            out.push(ch);
            if ch == '\\' {
                previous_backslashes += 1;
            } else {
                previous_backslashes = 0;
            }
        }
        out.push('\n');
    }
    out
}

fn is_ascii_command_char(byte: u8) -> bool {
    byte.is_ascii_alphabetic() || byte == b'@'
}

fn skip_latex_space_options(source: &str, mut index: usize) -> usize {
    let bytes = source.as_bytes();
    while index < bytes.len() && bytes[index].is_ascii_whitespace() {
        index += 1;
    }
    if index < bytes.len() && bytes[index] == b'*' {
        index += 1;
    }
    loop {
        while index < bytes.len() && bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        if index >= bytes.len() || bytes[index] != b'[' {
            break;
        }
        index += 1;
        let mut depth = 1usize;
        while index < bytes.len() && depth > 0 {
            match bytes[index] {
                b'[' => depth += 1,
                b']' => depth -= 1,
                _ => {}
            }
            index += 1;
        }
    }
    index
}

fn read_latex_braced_arg(source: &str, mut index: usize) -> Option<(String, usize)> {
    let bytes = source.as_bytes();
    while index < bytes.len() && bytes[index].is_ascii_whitespace() {
        index += 1;
    }
    if index >= bytes.len() || bytes[index] != b'{' {
        return None;
    }
    index += 1;
    let start = index;
    let mut depth = 1usize;
    while index < bytes.len() && depth > 0 {
        match bytes[index] {
            b'\\' => {
                index = (index + 2).min(bytes.len());
                continue;
            }
            b'{' => depth += 1,
            b'}' => depth -= 1,
            _ => {}
        }
        if depth == 0 {
            let arg = source[start..index].trim().to_string();
            return Some((arg, index + 1));
        }
        index += 1;
    }
    None
}

fn extract_latex_command_args(source: &str, command: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut index = 0usize;
    let command_bytes = command.as_bytes();
    while let Some(offset) = source[index..].find(command) {
        let pos = index + offset;
        let after = pos + command.len();
        let bytes = source.as_bytes();
        if after < bytes.len() && is_ascii_command_char(bytes[after]) {
            index = after;
            continue;
        }
        if pos > 0 && bytes[pos - 1] == b'\\' && !command_bytes.starts_with(b"\\") {
            index = after;
            continue;
        }
        let arg_start = skip_latex_space_options(source, after);
        if let Some((arg, next)) = read_latex_braced_arg(source, arg_start) {
            args.push(arg);
            index = next;
        } else {
            index = after;
        }
    }
    args
}

fn extract_latex_command_arg_pairs(source: &str, command: &str) -> Vec<(String, String)> {
    let mut pairs = Vec::new();
    let mut index = 0usize;
    while let Some(offset) = source[index..].find(command) {
        let pos = index + offset;
        let after = pos + command.len();
        let bytes = source.as_bytes();
        if after < bytes.len() && is_ascii_command_char(bytes[after]) {
            index = after;
            continue;
        }
        let first_start = skip_latex_space_options(source, after);
        if let Some((first, next)) = read_latex_braced_arg(source, first_start) {
            if let Some((second, tail)) = read_latex_braced_arg(source, next) {
                pairs.push((first, second));
                index = tail;
            } else {
                index = next;
            }
        } else {
            index = after;
        }
    }
    pairs
}

fn split_latex_csv(value: &str) -> Vec<String> {
    value
        .split(',')
        .filter_map(normalize_latex_path)
        .collect::<Vec<_>>()
}

fn extract_graphicspath_dirs(source: &str) -> Vec<String> {
    let mut dirs = Vec::new();
    for arg in extract_latex_command_args(source, "\\graphicspath") {
        let mut index = 0usize;
        while let Some((dir, next)) = read_latex_braced_arg(&arg, index) {
            if let Some(cleaned) = normalize_latex_path(&dir) {
                dirs.push(cleaned.trim_matches('/').to_string());
            }
            index = next;
        }
    }
    let mut seen = HashSet::new();
    dirs.retain(|item| seen.insert(item.clone()));
    dirs
}

fn has_latex_extension(target: &str) -> bool {
    Path::new(target).extension().and_then(|value| value.to_str()).is_some()
}

fn combine_relative_parts(parts: &[&str]) -> String {
    parts
        .iter()
        .map(|part| part.trim().trim_matches('/'))
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("/")
}

fn current_parent_relative(current_relative: &str) -> String {
    Path::new(current_relative)
        .parent()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .replace('\\', "/")
}

fn candidate_latex_relatives(
    current_relative: &str,
    target: &str,
    search_dirs: &[String],
    fallback_extensions: &[&str],
) -> Vec<String> {
    let Some(cleaned) = normalize_latex_path(target) else { return Vec::new(); };
    let mut base_dirs = Vec::<String>::new();
    if cleaned.starts_with('/') {
        base_dirs.push(String::new());
    } else if search_dirs.is_empty() {
        let parent = current_parent_relative(current_relative);
        base_dirs.push(parent);
        base_dirs.push(String::new());
    } else {
        let parent = current_parent_relative(current_relative);
        for dir in search_dirs {
            let normalized_dir = dir.trim().trim_matches('/').to_string();
            base_dirs.push(combine_relative_parts(&[&parent, &normalized_dir]));
            base_dirs.push(normalized_dir);
        }
        base_dirs.push(parent);
        base_dirs.push(String::new());
    }
    let mut seen_dirs = HashSet::new();
    base_dirs.retain(|item| seen_dirs.insert(item.clone()));

    let target_part = cleaned.trim_start_matches('/');
    let mut candidates = Vec::new();
    for base in base_dirs {
        let base_candidate = combine_relative_parts(&[&base, target_part]);
        if base_candidate.is_empty() {
            continue;
        }
        candidates.push(base_candidate.clone());
        if !has_latex_extension(&base_candidate) {
            for extension in fallback_extensions {
                let ext = extension.trim_start_matches('.');
                if !ext.is_empty() {
                    candidates.push(format!("{base_candidate}.{ext}"));
                }
            }
        }
    }
    let mut seen_candidates = HashSet::new();
    candidates.retain(|item| seen_candidates.insert(item.clone()));
    candidates
}

fn first_existing_candidate(root: &Path, candidates: &[String]) -> Option<String> {
    for candidate in candidates {
        if let Ok(path) = safe_join(root, candidate) {
            if path.is_file() {
                return Some(candidate.to_string());
            }
        }
    }
    None
}

fn is_parsable_latex_dependency(relative: &str) -> bool {
    matches!(
        Path::new(relative)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "tex" | "ltx" | "cls" | "sty" | "bbx" | "cbx" | "cfg" | "def" | "clo" | "ldf"
    )
}

fn add_latex_dependency(
    root: &Path,
    files: &mut Vec<String>,
    seen: &mut HashSet<String>,
    queue: &mut VecDeque<String>,
    relative: String,
) {
    let normalized = relative.trim().replace('\\', "/").trim_start_matches('/').to_string();
    if normalized.is_empty() || seen.contains(&normalized) {
        return;
    }
    if let Ok(path) = safe_join(root, &normalized) {
        if path.is_file() {
            seen.insert(normalized.clone());
            if is_parsable_latex_dependency(&normalized) {
                queue.push_back(normalized.clone());
            }
            files.push(normalized);
        }
    }
}

fn resolve_required_latex_dependency(
    root: &Path,
    files: &mut Vec<String>,
    seen: &mut HashSet<String>,
    queue: &mut VecDeque<String>,
    skipped: &mut Vec<String>,
    current_relative: &str,
    target: &str,
    search_dirs: &[String],
    fallback_extensions: &[&str],
) {
    let candidates = candidate_latex_relatives(current_relative, target, search_dirs, fallback_extensions);
    if let Some(existing) = first_existing_candidate(root, &candidates) {
        add_latex_dependency(root, files, seen, queue, existing);
    } else if !target.trim().is_empty() {
        skipped.push(format!("未找到引用文件：{} -> {}", current_relative, target.trim()));
    }
}

fn resolve_optional_latex_dependency(
    root: &Path,
    files: &mut Vec<String>,
    seen: &mut HashSet<String>,
    queue: &mut VecDeque<String>,
    current_relative: &str,
    target: &str,
    search_dirs: &[String],
    fallback_extensions: &[&str],
) {
    let candidates = candidate_latex_relatives(current_relative, target, search_dirs, fallback_extensions);
    if let Some(existing) = first_existing_candidate(root, &candidates) {
        add_latex_dependency(root, files, seen, queue, existing);
    }
}

fn collect_latex_dependency_files(root: &Path, main_tex: &str) -> Result<(Vec<String>, Vec<String>), String> {
    let main = normalize_latex_path(main_tex).ok_or_else(|| "主 TeX 文件路径为空。".to_string())?;
    let main_path = safe_join(root, &main)?;
    if !main_path.is_file() {
        return Err(format!("主 TeX 文件不存在：{}", main_path.display()));
    }

    let mut files = Vec::new();
    let mut skipped = Vec::new();
    let mut seen = HashSet::new();
    let mut queue = VecDeque::new();
    let mut global_graphic_dirs = Vec::<String>::new();
    add_latex_dependency(root, &mut files, &mut seen, &mut queue, main.clone());

    // Common compile helper files are useful in submission packages when they are explicitly present,
    // but they are not scanned recursively and are never used to pull in the entire project.
    for optional in [".latexmkrc", "latexmkrc"] {
        if let Ok(path) = safe_join(root, optional) {
            if path.is_file() {
                add_latex_dependency(root, &mut files, &mut seen, &mut queue, optional.to_string());
            }
        }
    }

    let main_stem = Path::new(&main).with_extension("bbl").to_string_lossy().replace('\\', "/");
    if let Ok(path) = safe_join(root, &main_stem) {
        if path.is_file() {
            add_latex_dependency(root, &mut files, &mut seen, &mut queue, main_stem);
        }
    }

    while let Some(current_relative) = queue.pop_front() {
        let path = safe_join(root, &current_relative)?;
        let Ok(source) = fs::read_to_string(&path) else { continue; };
        let source = strip_latex_comments(&source);
        let mut graphic_dirs = extract_graphicspath_dirs(&source);
        global_graphic_dirs.append(&mut graphic_dirs);
        let mut seen_graphic_dirs = HashSet::new();
        global_graphic_dirs.retain(|item| seen_graphic_dirs.insert(item.clone()));

        for target in extract_latex_command_args(&source, "\\input") {
            resolve_required_latex_dependency(root, &mut files, &mut seen, &mut queue, &mut skipped, &current_relative, &target, &[], &["tex", "ltx", "tikz", "pgf"]);
        }
        for target in extract_latex_command_args(&source, "\\include") {
            resolve_required_latex_dependency(root, &mut files, &mut seen, &mut queue, &mut skipped, &current_relative, &target, &[], &["tex", "ltx"]);
        }
        for target in extract_latex_command_args(&source, "\\subfile") {
            resolve_required_latex_dependency(root, &mut files, &mut seen, &mut queue, &mut skipped, &current_relative, &target, &[], &["tex", "ltx"]);
        }
        for (dir, target) in extract_latex_command_arg_pairs(&source, "\\import")
            .into_iter()
            .chain(extract_latex_command_arg_pairs(&source, "\\subimport"))
            .chain(extract_latex_command_arg_pairs(&source, "\\inputfrom")) {
            let combined = combine_relative_parts(&[&dir, &target]);
            resolve_required_latex_dependency(root, &mut files, &mut seen, &mut queue, &mut skipped, &current_relative, &combined, &[], &["tex", "ltx"]);
        }

        for target in extract_latex_command_args(&source, "\\includegraphics")
            .into_iter()
            .chain(extract_latex_command_args(&source, "\\includesvg")) {
            resolve_required_latex_dependency(root, &mut files, &mut seen, &mut queue, &mut skipped, &current_relative, &target, &global_graphic_dirs, &["pdf", "png", "jpg", "jpeg", "eps", "svg"]);
        }
        for target in extract_latex_command_args(&source, "\\lstinputlisting") {
            resolve_required_latex_dependency(root, &mut files, &mut seen, &mut queue, &mut skipped, &current_relative, &target, &[], &[]);
        }
        for (_, target) in extract_latex_command_arg_pairs(&source, "\\inputminted") {
            resolve_required_latex_dependency(root, &mut files, &mut seen, &mut queue, &mut skipped, &current_relative, &target, &[], &[]);
        }

        for target in extract_latex_command_args(&source, "\\addbibresource") {
            resolve_required_latex_dependency(root, &mut files, &mut seen, &mut queue, &mut skipped, &current_relative, &target, &[], &["bib"]);
        }
        for bibliography_group in extract_latex_command_args(&source, "\\bibliography") {
            for target in split_latex_csv(&bibliography_group) {
                resolve_required_latex_dependency(root, &mut files, &mut seen, &mut queue, &mut skipped, &current_relative, &target, &[], &["bib"]);
            }
        }

        for class_name in extract_latex_command_args(&source, "\\documentclass") {
            for target in split_latex_csv(&class_name) {
                resolve_optional_latex_dependency(root, &mut files, &mut seen, &mut queue, &current_relative, &target, &[], &["cls"]);
            }
        }
        for package_group in extract_latex_command_args(&source, "\\usepackage")
            .into_iter()
            .chain(extract_latex_command_args(&source, "\\RequirePackage"))
            .chain(extract_latex_command_args(&source, "\\LoadClass")) {
            for target in split_latex_csv(&package_group) {
                resolve_optional_latex_dependency(root, &mut files, &mut seen, &mut queue, &current_relative, &target, &[], &["sty", "cls"]);
            }
        }
        for style_group in extract_latex_command_args(&source, "\\bibliographystyle") {
            for target in split_latex_csv(&style_group) {
                resolve_optional_latex_dependency(root, &mut files, &mut seen, &mut queue, &current_relative, &target, &[], &["bst"]);
            }
        }
    }

    files.sort();
    files.dedup();
    skipped.sort();
    skipped.dedup();
    Ok((files, skipped))
}

fn collect_markdown_submission_files(root: &Path, main_markdown: &str) -> Result<(Vec<String>, Vec<String>), String> {
    let main = normalize_latex_path(main_markdown).ok_or_else(|| "主 Markdown 文件路径为空。".to_string())?;
    let path = safe_join(root, &main)?;
    if !path.is_file() {
        return Err(format!("主 Markdown 文件不存在：{}", path.display()));
    }
    let source = fs::read_to_string(&path).map_err(|error| format!("无法读取 Markdown：{error}"))?;
    let mut files = vec![main.clone()];
    let mut skipped = Vec::new();
    for target in extract_markdown_image_targets(&source) {
        let relative = workspace_asset_relative(&main, &target);
        match safe_join(root, &relative) {
            Ok(asset_path) if asset_path.is_file() => files.push(relative),
            _ => skipped.push(format!("未找到引用资源：{} -> {}", main, target)),
        }
    }
    files.sort();
    files.dedup();
    Ok((files, skipped))
}

#[tauri::command]
fn publish_markdown_profile(root_dir: String, relative_path: String, profile: PublishProfile) -> Result<PackageExportResult, String> {
    let root = PathBuf::from(root_dir);
    let md_path = safe_join(&root, &relative_path)?;
    if !md_path.exists() { return Err(format!("Markdown 文件不存在：{}", md_path.display())); }
    let source = fs::read_to_string(&md_path).map_err(|error| format!("无法读取 Markdown：{error}"))?;
    let stem = md_path.file_stem().and_then(|value| value.to_str()).unwrap_or("post");
    let slug = slugify(stem);
    let title = markdown_title(&source, stem);
    let mut body = strip_yaml_frontmatter(&source);
    let output_rel = if profile.engine == "jekyll" {
        format!("{}/{}-{}.md", profile.content_dir.trim_matches('/'), safe_timestamp(), slug)
    } else {
        format!("{}/{}/index.md", profile.content_dir.trim_matches('/'), slug)
    };
    let output_path = safe_join(&root, &output_rel)?;
    let mut copied = Vec::new();
    let mut skipped = Vec::new();
    if profile.resource_strategy == "copy-local" {
        for target in extract_markdown_image_targets(&source) {
            let asset_relative = workspace_asset_relative(&relative_path, &target);
            let file_name = Path::new(&asset_relative).file_name().and_then(|value| value.to_str()).unwrap_or("asset").to_string();
            let asset_dest = format!("{}/{}", profile.asset_dir.trim_matches('/'), file_name);
            let source_path = safe_join(&root, &asset_relative)?;
            let target_path = safe_join(&root, &asset_dest)?;
            if source_path.is_file() {
                if let Some(parent) = target_path.parent() { fs::create_dir_all(parent).map_err(|error| format!("无法创建资源目录：{error}"))?; }
                match fs::copy(&source_path, &target_path) {
                    Ok(_) => copied.push(asset_dest.clone()),
                    Err(error) => skipped.push(format!("{asset_relative} ({error})")),
                }
                body = body.replace(&target, &public_asset_path(&profile.asset_dir, &file_name));
            }
        }
    }
    let frontmatter = if profile.frontmatter_mode == "toml" {
        format!("+++\ntitle = \"{}\"\ndate = \"{}\"\ndraft = {}\nscholia_source = \"{}\"\n+++\n\n", title.replace('"', "\\\""), safe_timestamp(), profile.draft.unwrap_or(true), relative_path)
    } else {
        format!("---\ntitle: \"{}\"\ndate: \"{}\"\ndraft: {}\nscholia_source: \"{}\"\n---\n\n", title.replace('"', "\\\""), safe_timestamp(), profile.draft.unwrap_or(true), relative_path)
    };
    if let Some(parent) = output_path.parent() { fs::create_dir_all(parent).map_err(|error| format!("无法创建发布目录：{error}"))?; }
    fs::write(&output_path, format!("{frontmatter}{body}\n")).map_err(|error| format!("无法写入发布文件：{error}"))?;
    copied.push(output_rel.clone());
    let manifest_path = write_package_manifest(output_path.parent().unwrap_or(&root), &format!("{} publish profile", profile.name), &copied, &skipped, &[format!("Engine: {}", profile.engine), format!("Profile ID: {}", profile.id), format!("Base URL: {}", profile.base_url.unwrap_or_default())])?;
    Ok(PackageExportResult { ok: skipped.is_empty(), output_dir: output_path.parent().unwrap_or(&root).to_string_lossy().to_string(), copied_files: copied, skipped_files: skipped, manifest_path })
}

fn package_output_dir(root: &Path, output_root: Option<String>, fallback_folder: &str, prefix: &str) -> Result<PathBuf, String> {
    let timestamp = safe_timestamp();
    let base = output_root
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| root.join(".paper-notes").join(fallback_folder));
    let output_dir = base.join(format!("{prefix}-{timestamp}"));
    fs::create_dir_all(&output_dir).map_err(|error| format!("无法创建导出目录 {}：{error}", output_dir.display()))?;
    Ok(output_dir)
}

#[tauri::command]
fn export_submission_package(root_dir: String, main_tex: Option<String>, main_markdown: Option<String>, pdf_path: Option<String>, output_root: Option<String>) -> Result<PackageExportResult, String> {
    let root = PathBuf::from(root_dir);
    let output_dir = package_output_dir(&root, output_root, "submission-packages", "submission-package")?;
    let tex_entry = main_tex
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let markdown_entry = main_markdown
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let (mut candidates, dependency_skips) = if let Some(path) = tex_entry {
        collect_latex_dependency_files(&root, path)?
    } else if let Some(path) = markdown_entry {
        collect_markdown_submission_files(&root, path)?
    } else {
        return Err("投稿包导出需要打开当前 TeX 文件，或在项目设置中指定主 TeX 文件。".into());
    };
    candidates.sort();
    candidates.dedup();
    let mut copied = Vec::new();
    let mut skipped = dependency_skips;
    for relative in candidates { copy_relative_file(&root, &relative, &output_dir, &mut copied, &mut skipped); }
    if let Some(pdf) = pdf_path.filter(|value| !value.trim().is_empty()) {
        let pdf_path = PathBuf::from(&pdf);
        if pdf_path.is_file() {
            let target = output_dir.join("compiled").join(pdf_path.file_name().and_then(|value| value.to_str()).unwrap_or("paper.pdf"));
            if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(|error| format!("无法创建 compiled 目录：{error}"))?; }
            match fs::copy(&pdf_path, &target) {
                Ok(_) => copied.push(normalized_relative(&output_dir, &target)),
                Err(error) => skipped.push(format!("{pdf} ({error})")),
            }
        }
    }
    let notes = vec![
        "This folder is a source submission package. Review README and compile instructions before uploading to a journal/conference system.".to_string(),
        "Files are collected from the active/main TeX dependency graph instead of copying the whole workspace.".to_string(),
    ];
    let manifest_path = write_package_manifest(&output_dir, "Submission package", &copied, &skipped, &notes)?;
    Ok(PackageExportResult { ok: skipped.is_empty(), output_dir: output_dir.to_string_lossy().to_string(), copied_files: copied, skipped_files: skipped, manifest_path })
}

#[tauri::command]
fn export_shared_review_package(root_dir: String, pdf_path: Option<String>, include_resolved: bool, output_root: Option<String>) -> Result<PackageExportResult, String> {
    let root = PathBuf::from(root_dir);
    let output_dir = package_output_dir(&root, output_root, "shared-review-packages", "shared-review-package")?;
    let mut copied = Vec::new();
    let mut skipped = Vec::new();
    for relative in [".paper-notes/annotations.jsonl", ".paper-notes/review-items.jsonl", ".paper-notes/review-summary.md"] {
        copy_relative_file(&root, relative, &output_dir, &mut copied, &mut skipped);
    }
    let mut source_context = Vec::new();
    collect_package_files(&root, &root, &mut source_context)?;
    source_context.sort();
    source_context.dedup();
    for relative in source_context {
        let ext = Path::new(&relative).extension().and_then(|value| value.to_str()).unwrap_or_default().to_ascii_lowercase();
        if !matches!(ext.as_str(), "tex" | "ltx" | "md" | "markdown" | "bib" | "cls" | "sty" | "bst") { continue; }
        let Ok(source) = safe_join(&root, &relative) else { skipped.push(relative); continue; };
        if !source.is_file() { skipped.push(relative); continue; }
        let target = output_dir.join("source-context").join(&relative);
        if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(|error| format!("无法创建源码上下文目录：{error}"))?; }
        match fs::copy(&source, &target) {
            Ok(_) => copied.push(format!("source-context/{relative}")),
            Err(error) => skipped.push(format!("{relative} ({error})")),
        }
    }
    if let Some(pdf) = pdf_path.filter(|value| !value.trim().is_empty()) {
        let pdf_path = PathBuf::from(&pdf);
        if pdf_path.is_file() {
            let target = output_dir.join("review.pdf");
            match fs::copy(&pdf_path, &target) {
                Ok(_) => copied.push("review.pdf".into()),
                Err(error) => skipped.push(format!("{pdf} ({error})")),
            }
        } else {
            skipped.push(pdf);
        }
    }
    let notes = vec![
        "Shared review package includes PDF, review-items and annotation JSONL when available.".to_string(),
        format!("Resolved annotations included: {include_resolved}"),
    ];
    let manifest_path = write_package_manifest(&output_dir, "Shared review package", &copied, &skipped, &notes)?;
    Ok(PackageExportResult { ok: skipped.is_empty(), output_dir: output_dir.to_string_lossy().to_string(), copied_files: copied, skipped_files: skipped, manifest_path })
}

fn hash_text(value: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    value.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

#[tauri::command]
fn compile_tikz_preview(root_dir: String, current_relative_path: String, source: String, tool_paths: Option<ToolPathOverrides>) -> Result<String, String> {
    let root = PathBuf::from(root_dir);
    let cache_dir = root.join(".paper-notes").join("tikz-cache").join(hash_text(&format!("{current_relative_path}\n{source}")));
    fs::create_dir_all(&cache_dir).map_err(|error| format!("无法创建 TikZ 缓存目录：{error}"))?;
    let tex_path = cache_dir.join("preview.tex");
    let pdf_path = cache_dir.join("preview.pdf");
    if !pdf_path.exists() {
        let wrapped = format!("\\documentclass[tikz,border=2pt]{{standalone}}\n\\usepackage{{tikz}}\n\\usepackage{{pgfplots}}\n\\pgfplotsset{{compat=1.18}}\n\\begin{{document}}\n{}\n\\end{{document}}\n", source);
        fs::write(&tex_path, wrapped).map_err(|error| format!("无法写入 TikZ 临时文件：{error}"))?;
        let overrides = tool_paths.unwrap_or_default();
        let xelatex = tool_program("xelatex", &overrides);
        let output = Command::new(&xelatex)
            .current_dir(&cache_dir)
            .args(["-interaction=nonstopmode", "-halt-on-error", "preview.tex"])
            .output()
            .map_err(|error| format!("无法执行 XeLaTeX 编译 TikZ：{error}"))?;
        if !output.status.success() || !pdf_path.exists() {
            return Err(format!("TikZ 编译失败：\n{}{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr)));
        }
    }
    let bytes = fs::read(&pdf_path).map_err(|error| format!("无法读取 TikZ PDF：{error}"))?;
    Ok(format!("data:application/pdf;base64,{}", encode_base64(&bytes)))
}

fn conflicted_files_from_status(root: &Path) -> Vec<String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(root).args(["status", "--porcelain"]);
    let output = cmd.output().ok();
    let text = output.map(|out| String::from_utf8_lossy(&out.stdout).to_string()).unwrap_or_default();
    text.lines().filter_map(|line| {
        if line.len() < 4 { return None; }
        let code = &line[..2];
        let conflict = matches!(code, "UU" | "AA" | "DD" | "AU" | "UA" | "DU" | "UD");
        conflict.then(|| line[3..].to_string())
    }).collect()
}

#[tauri::command]
fn git_pull_with_conflict_status(root_dir: String, branch: String, token: Option<String>) -> Result<GitSyncResult, String> {
    let root = PathBuf::from(root_dir);
    let branch = if branch.trim().is_empty() { "main" } else { branch.trim() };
    let mut cmd = git_with_auth(Some(&root), token.as_deref());
    cmd.args(["pull", "--no-rebase", "origin", branch]);
    let output = cmd.output().map_err(|error| format!("无法执行 git pull：{error}"))?;
    let log = format!("{}{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
    let conflicts = conflicted_files_from_status(&root);
    Ok(GitSyncResult { ok: output.status.success() && conflicts.is_empty(), command: format!("git pull --no-rebase origin {branch}"), log, conflicted_files: conflicts })
}

#[tauri::command]
fn git_push_current_branch(root_dir: String, branch: String, token: Option<String>) -> Result<GitSyncResult, String> {
    let root = PathBuf::from(root_dir);
    let branch = if branch.trim().is_empty() { "main" } else { branch.trim() };
    let mut cmd = git_with_auth(Some(&root), token.as_deref());
    cmd.args(["push", "origin", branch]);
    let output = cmd.output().map_err(|error| format!("无法执行 git push：{error}"))?;
    let log = format!("{}{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
    let conflicts = conflicted_files_from_status(&root);
    Ok(GitSyncResult { ok: output.status.success() && conflicts.is_empty(), command: format!("git push origin {branch}"), log, conflicted_files: conflicts })
}

fn build_latex_blocking(root_dir: String, relative_path: String, tool_paths: Option<ToolPathOverrides>) -> Result<LatexBuildResult, String> {
    let root = PathBuf::from(root_dir);
    let requested_tex_path = safe_join(&root, &relative_path)?;
    if !requested_tex_path.exists() {
        return Err(format!("LaTeX 文件不存在：{}", requested_tex_path.display()));
    }
    let tex_path = read_tex_root(&requested_tex_path);
    if !tex_path.exists() {
        return Err(format!("找到了 root 指令，但主 LaTeX 文件不存在：{}", tex_path.display()));
    }
    let work_dir = tex_path.parent().ok_or_else(|| "无法获取 LaTeX 文件目录。".to_string())?;
    let file_name = tex_path.file_name().and_then(|v| v.to_str()).ok_or_else(|| "LaTeX 文件名无效。".to_string())?;
    let stem = tex_path.file_stem().and_then(|v| v.to_str()).ok_or_else(|| "LaTeX 文件名无效。".to_string())?;
    let engine = read_tex_program(&tex_path);
    let overrides = tool_paths.unwrap_or_default();
    let latexmk_program = tool_program("latexmk", &overrides);
    let engine_program = if engine == "xelatex" { tool_program("xelatex", &overrides) } else { engine.to_string() };
    let latexmk_mode = latexmk_mode_arg(engine);

    let run_latexmk = || -> Result<(bool, String), std::io::Error> {
        let mut latexmk = Command::new(&latexmk_program);
        latexmk.current_dir(work_dir).args([latexmk_mode, "-interaction=nonstopmode", "-synctex=1", "-file-line-error", file_name]);
        let output = latexmk.output()?;
        Ok((
            output.status.success(),
            format!("$ {} {latexmk_mode} -interaction=nonstopmode -synctex=1 -file-line-error {file_name}\n{}{}", latexmk_program, String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr)),
        ))
    };

    match run_latexmk() {
        Ok((success, mut log)) => {
            let pdf_path = tex_path.with_extension("pdf");
            let mut final_success = success;
            if !success && latexmk_previous_invocation_error(&log) {
                match clean_latex_artifacts_for_tex(&tex_path) {
                    Ok(removed) => log.push_str(&format!("\nScholia Studio: 检测到 latexmk 记录了上一次失败状态，已自动清理 {removed} 个辅助文件并重试。\n")),
                    Err(error) => log.push_str(&format!("\nScholia Studio: 自动清理辅助文件失败：{error}\n")),
                }
                match run_latexmk() {
                    Ok((retry_success, retry_log)) => {
                        final_success = retry_success;
                        log.push_str(&retry_log);
                    }
                    Err(error) => {
                        final_success = false;
                        log.push_str(&format!("\nScholia Studio: 清理后重试 latexmk 失败：{error}\n"));
                    }
                }
            }
            return Ok(LatexBuildResult {
                ok: final_success && pdf_path.exists(),
                command: format!("{} {latexmk_mode} -interaction=nonstopmode -synctex=1 -file-line-error {file_name}", latexmk_program),
                pdf_path: pdf_path.exists().then(|| pdf_path.to_string_lossy().to_string()),
                diagnostics: parse_latex_diagnostics(&log, &root, work_dir),
                log,
            });
        }
        Err(_) => {
            // Fallback for machines that only have one TeX engine + bibtex/biber.
            let mut combined = format!("latexmk 不可用，回退到 {engine_program}/bibtex/biber 多轮构建。\n");
            let mut ok = true;
            let first = run_latex_command(work_dir, &engine_program, &["-interaction=nonstopmode", "-synctex=1", "-file-line-error", file_name]);
            match first {
                Ok((success, log)) => { ok &= success; combined.push_str(&log); }
                Err(error) => return Err(format!("无法执行 {latexmk_program} 或 {engine_program}。请先安装 TeX Live/MiKTeX 并配置 PATH，或在设置中手动填写路径。原始错误：{error}")),
            }

            let aux = work_dir.join(format!("{stem}.aux"));
            let bcf = work_dir.join(format!("{stem}.bcf"));
            if tex_uses_bibliography(&tex_path) || aux.exists() || bcf.exists() {
                if bcf.exists() {
                    match run_latex_command(work_dir, "biber", &[stem]) {
                        Ok((success, log)) => { ok &= success; combined.push_str(&log); }
                        Err(error) => combined.push_str(&format!("biber 不可用或执行失败：{error}\n")),
                    }
                } else if aux.exists() {
                    match run_latex_command(work_dir, "bibtex", &[stem]) {
                        Ok((success, log)) => { ok &= success; combined.push_str(&log); }
                        Err(error) => combined.push_str(&format!("bibtex 不可用或执行失败：{error}\n")),
                    }
                }
            }

            for _ in 0..2 {
                match run_latex_command(work_dir, &engine_program, &["-interaction=nonstopmode", "-synctex=1", "-file-line-error", file_name]) {
                    Ok((success, log)) => { ok &= success; combined.push_str(&log); }
                    Err(error) => { ok = false; combined.push_str(&format!("{engine_program} 执行失败：{error}\n")); }
                }
            }
            let pdf_path = tex_path.with_extension("pdf");
            Ok(LatexBuildResult {
                ok: ok && pdf_path.exists(),
                command: format!("{} + {} + {} x2", engine_program, if bcf.exists() { "biber" } else { "bibtex" }, engine_program),
                pdf_path: pdf_path.exists().then(|| pdf_path.to_string_lossy().to_string()),
                diagnostics: parse_latex_diagnostics(&combined, &root, work_dir),
                log: combined,
            })
        }
    }
}

#[tauri::command]
async fn build_latex(root_dir: String, relative_path: String, tool_paths: Option<ToolPathOverrides>) -> Result<LatexBuildResult, String> {
    tauri::async_runtime::spawn_blocking(move || build_latex_blocking(root_dir, relative_path, tool_paths))
        .await
        .map_err(|error| format!("LaTeX 后台任务失败：{error}"))?
}

fn parse_synctex_value<'a>(log: &'a str, key: &str) -> Option<&'a str> {
    log.lines().find_map(|line| {
        line.strip_prefix(key)
            .or_else(|| line.strip_prefix(&key.to_ascii_lowercase()))
            .map(|value| value.trim())
    })
}

fn parse_synctex_number(log: &str, key: &str) -> Option<f64> {
    parse_synctex_value(log, key).and_then(|value| value.parse::<f64>().ok())
}

fn parse_synctex_u32(log: &str, key: &str) -> Option<u32> {
    parse_synctex_value(log, key).and_then(|value| value.parse::<u32>().ok())
}

fn relative_path_if_inside(root: &Path, path: &Path) -> Option<String> {
    path.strip_prefix(root).ok().map(|value| value.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
fn synctex_forward(root_dir: String, relative_path: String, line: u32, column: u32, tool_paths: Option<ToolPathOverrides>) -> Result<PdfSyncPoint, String> {
    let root = PathBuf::from(root_dir);
    let requested_tex_path = safe_join(&root, &relative_path)?;
    if !requested_tex_path.exists() {
        return Err(format!("TeX 文件不存在：{}", requested_tex_path.display()));
    }
    let tex_path = read_tex_root(&requested_tex_path);
    let pdf_path = tex_path.with_extension("pdf");
    if !pdf_path.exists() {
        return Err(format!("PDF 不存在，请先构建：{}", pdf_path.display()));
    }
    let input = format!("{}:{}:{}", line.max(1), column.max(1), requested_tex_path.to_string_lossy());
    let pdf_str = pdf_path.to_string_lossy().to_string();
    let synctex_program = tool_program("synctex", &tool_paths.unwrap_or_default());
    let output = Command::new(&synctex_program)
        .args(["view", "-i", &input, "-o", &pdf_str])
        .output()
        .map_err(|error| format!("无法执行 synctex。请确认 TeX Live/MiKTeX 已安装并在 PATH 中：{error}"))?;
    let log = format!("{}{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
    if !output.status.success() {
        return Err(format!("synctex view 执行失败：\n{log}"));
    }
    let page = parse_synctex_u32(&log, "Page:").ok_or_else(|| format!("无法从 SyncTeX 输出解析页码：\n{log}"))?;
    let x = parse_synctex_number(&log, "x:").unwrap_or(0.0);
    let y = parse_synctex_number(&log, "y:").unwrap_or(0.0);
    Ok(PdfSyncPoint {
        page,
        x,
        y,
        h: parse_synctex_number(&log, "h:"),
        v: parse_synctex_number(&log, "v:"),
        width: parse_synctex_number(&log, "W:"),
        height: parse_synctex_number(&log, "H:"),
        pdf_path: Some(pdf_path.to_string_lossy().to_string()),
    })
}

#[tauri::command]
fn synctex_reverse(root_dir: String, pdf_path: String, page: u32, x: f64, y: f64, tool_paths: Option<ToolPathOverrides>) -> Result<TexSourcePoint, String> {
    let root = PathBuf::from(root_dir);
    let pdf = PathBuf::from(pdf_path);
    if !pdf.exists() {
        return Err(format!("PDF 不存在：{}", pdf.display()));
    }
    let pdf_str = pdf.to_string_lossy().to_string();
    let query = format!("{}:{}:{}:{}", page.max(1), x, y, pdf_str);
    let synctex_program = tool_program("synctex", &tool_paths.unwrap_or_default());
    let output = Command::new(&synctex_program)
        .args(["edit", "-o", &query])
        .output()
        .map_err(|error| format!("无法执行 synctex。请确认 TeX Live/MiKTeX 已安装并在 PATH 中：{error}"))?;
    let log = format!("{}{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
    if !output.status.success() {
        return Err(format!("synctex edit 执行失败：\n{log}"));
    }
    let input = parse_synctex_value(&log, "Input:").ok_or_else(|| format!("无法从 SyncTeX 输出解析源文件：\n{log}"))?.to_string();
    let line = parse_synctex_u32(&log, "Line:").unwrap_or(1);
    let column = parse_synctex_u32(&log, "Column:");
    let input_path = PathBuf::from(&input);
    Ok(TexSourcePoint {
        relative_path: relative_path_if_inside(&root, &input_path),
        input,
        line,
        column,
    })
}

#[tauri::command]
fn clean_latex(root_dir: String, relative_path: String) -> Result<String, String> {
    let root = PathBuf::from(root_dir);
    let requested_tex_path = safe_join(&root, &relative_path)?;
    let tex_path = read_tex_root(&requested_tex_path);
    let removed = clean_latex_artifacts_for_tex(&tex_path)?;
    Ok(format!("已清理 {removed} 个 LaTeX 生成文件。"))
}

#[tauri::command]
fn open_pdf(path: String) -> Result<(), String> {
    open_path_or_url(&path)
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    open_path_or_url(&path)
}

fn open_path_or_url(value: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", value])
            .spawn()
            .map_err(|error| format!("无法打开：{error}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(value)
            .spawn()
            .map_err(|error| format!("无法打开：{error}"))?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(value)
            .spawn()
            .map_err(|error| format!("无法打开：{error}"))?;
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_app_state,
            save_app_state,
            read_text_file,
            current_system_username,
            pick_local_folder,
            pick_local_file,
            create_sample_workspace,
            write_text_file,
            save_text_file_with_dialog,
            set_secret,
            get_secret,
            delete_secret,
            open_external_url,
            check_environment,
            list_workspace_files,
            read_workspace_file,
            read_workspace_data_url,
            read_file_data_url,
            write_workspace_file,
            read_workspace_annotations,
            write_workspace_annotations,
            create_workspace_file,
            create_workspace_folder,
            rename_workspace_item,
            delete_workspace_item,
            clone_or_update_repository,
            git_status,
            commit_and_push,
            build_latex,
            build_markdown_pandoc,
            export_markdown_pandoc,
            publish_markdown_profile,
            export_submission_package,
            export_shared_review_package,
            compile_tikz_preview,
            git_pull_with_conflict_status,
            git_push_current_branch,
            find_latex_pdf,
            synctex_forward,
            synctex_reverse,
            clean_latex,
            open_pdf,
            open_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running markdown latex git desktop");
}
