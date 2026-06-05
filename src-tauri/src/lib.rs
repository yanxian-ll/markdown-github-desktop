use keyring::{Entry, Error as KeyringError};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
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
        return Err("不是本地图片路径。".into());
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
        return Err(format!("图片不存在：{}", path.display()));
    }
    if !is_image_file(&path) {
        return Err(format!("不是支持的图片文件：{}", path.display()));
    }
    let bytes = fs::read(&path).map_err(|error| format!("无法读取图片 {}：{error}", path.display()))?;
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

#[tauri::command]
fn delete_workspace_item(root_dir: String, relative_path: String) -> Result<(), String> {
    let root = PathBuf::from(root_dir);
    let path = safe_join(&root, &relative_path)?;
    if !path.exists() {
        return Err(format!("路径不存在：{}", path.display()));
    }
    let meta = fs::metadata(&path).map_err(|error| format!("无法读取路径元数据：{error}"))?;
    if meta.is_dir() {
        fs::remove_dir_all(&path).map_err(|error| format!("无法删除文件夹 {}：{error}", path.display()))
    } else {
        fs::remove_file(&path).map_err(|error| format!("无法删除文件 {}：{error}", path.display()))
    }
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

fn parse_latex_diagnostics(log: &str) -> Vec<LatexDiagnostic> {
    let mut diagnostics = Vec::new();
    let mut current_file: Option<String> = None;
    for line in log.lines() {
        if line.ends_with(".tex") || line.contains(".tex:") {
            if let Some(idx) = line.find(".tex") {
                let start = line[..idx].rfind(|c| c == ' ' || c == '(' || c == '/' || c == '\\').map(|i| i + 1).unwrap_or(0);
                current_file = Some(line[start..idx + 4].to_string());
            }
        }
        if let Some(rest) = line.strip_prefix('!') {
            diagnostics.push(LatexDiagnostic {
                level: "error".into(),
                message: rest.trim().to_string(),
                file: current_file.clone(),
                line: None,
            });
        } else if line.contains(": error:") || line.contains("Error:") {
            diagnostics.push(LatexDiagnostic {
                level: "error".into(),
                message: line.trim().to_string(),
                file: current_file.clone(),
                line: None,
            });
        } else if line.contains("LaTeX Warning:")
            || line.contains("Package ") && line.contains(" Warning:")
            || line.contains("Citation ") && line.contains("undefined")
            || line.contains("Reference ") && line.contains("undefined")
        {
            diagnostics.push(LatexDiagnostic {
                level: "warning".into(),
                message: line.trim().to_string(),
                file: current_file.clone(),
                line: None,
            });
        }
    }
    diagnostics
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

fn tex_uses_bibliography(tex_path: &Path) -> bool {
    let content = fs::read_to_string(tex_path).unwrap_or_default();
    content.contains("\\bibliography{") || content.contains("\\addbibresource{") || content.contains("\\printbibliography")
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

fn build_markdown_pandoc_blocking(root_dir: String, relative_path: String) -> Result<LatexBuildResult, String> {
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
    let mut cmd = Command::new("pandoc");
    cmd.current_dir(work_dir)
        .arg(&temp_path)
        .args(["--from", "markdown+tex_math_dollars+raw_tex+yaml_metadata_block+fenced_divs"])
        .args(["--standalone", "--pdf-engine=xelatex"])
        .args(["-o", &pdf_path.to_string_lossy()]);
    let output = cmd.output().map_err(|error| format!("无法执行 pandoc。请先安装 Pandoc 并配置 PATH：{error}"))?;
    let log = format!("$ pandoc {file_name} --pdf-engine=xelatex -o {}\n{}{}", pdf_path.display(), String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
    Ok(LatexBuildResult {
        ok: output.status.success() && pdf_path.exists(),
        command: format!("pandoc {file_name} --pdf-engine=xelatex"),
        pdf_path: pdf_path.exists().then(|| pdf_path.to_string_lossy().to_string()),
        diagnostics: parse_pandoc_diagnostics(&log, &relative_path),
        log,
    })
}

#[tauri::command]
async fn build_markdown_pandoc(root_dir: String, relative_path: String) -> Result<LatexBuildResult, String> {
    tauri::async_runtime::spawn_blocking(move || build_markdown_pandoc_blocking(root_dir, relative_path))
        .await
        .map_err(|error| format!("Pandoc 后台任务失败：{error}"))?
}

fn build_latex_blocking(root_dir: String, relative_path: String) -> Result<LatexBuildResult, String> {
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

    let mut latexmk = Command::new("latexmk");
    latexmk.current_dir(work_dir).args(["-pdf", "-interaction=nonstopmode", "-synctex=1", "-file-line-error", file_name]);
    match latexmk.output() {
        Ok(output) => {
            let log = format!("$ latexmk -pdf -interaction=nonstopmode -synctex=1 -file-line-error {file_name}\n{}{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
            let pdf_path = tex_path.with_extension("pdf");
            return Ok(LatexBuildResult {
                ok: output.status.success() && pdf_path.exists(),
                command: format!("latexmk -pdf -interaction=nonstopmode -synctex=1 -file-line-error {file_name}"),
                pdf_path: pdf_path.exists().then(|| pdf_path.to_string_lossy().to_string()),
                diagnostics: parse_latex_diagnostics(&log),
                log,
            });
        }
        Err(_) => {
            // Fallback for machines that only have pdflatex + bibtex/biber.
            let mut combined = String::from("latexmk 不可用，回退到 pdflatex/bibtex/biber 多轮构建。\n");
            let mut ok = true;
            let first = run_latex_command(work_dir, "pdflatex", &["-interaction=nonstopmode", "-synctex=1", "-file-line-error", file_name]);
            match first {
                Ok((success, log)) => { ok &= success; combined.push_str(&log); }
                Err(error) => return Err(format!("无法执行 latexmk 或 pdflatex。请先安装 TeX Live/MiKTeX 并配置 PATH。原始错误：{error}")),
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
                match run_latex_command(work_dir, "pdflatex", &["-interaction=nonstopmode", "-synctex=1", "-file-line-error", file_name]) {
                    Ok((success, log)) => { ok &= success; combined.push_str(&log); }
                    Err(error) => { ok = false; combined.push_str(&format!("pdflatex 执行失败：{error}\n")); }
                }
            }
            let pdf_path = tex_path.with_extension("pdf");
            Ok(LatexBuildResult {
                ok: ok && pdf_path.exists(),
                command: format!("pdflatex + {} + pdflatex x2", if bcf.exists() { "biber" } else { "bibtex" }),
                pdf_path: pdf_path.exists().then(|| pdf_path.to_string_lossy().to_string()),
                diagnostics: parse_latex_diagnostics(&combined),
                log: combined,
            })
        }
    }
}

#[tauri::command]
async fn build_latex(root_dir: String, relative_path: String) -> Result<LatexBuildResult, String> {
    tauri::async_runtime::spawn_blocking(move || build_latex_blocking(root_dir, relative_path))
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
fn synctex_forward(root_dir: String, relative_path: String, line: u32, column: u32) -> Result<PdfSyncPoint, String> {
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
    let output = Command::new("synctex")
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
fn synctex_reverse(root_dir: String, pdf_path: String, page: u32, x: f64, y: f64) -> Result<TexSourcePoint, String> {
    let root = PathBuf::from(root_dir);
    let pdf = PathBuf::from(pdf_path);
    if !pdf.exists() {
        return Err(format!("PDF 不存在：{}", pdf.display()));
    }
    let pdf_str = pdf.to_string_lossy().to_string();
    let query = format!("{}:{}:{}:{}", page.max(1), x, y, pdf_str);
    let output = Command::new("synctex")
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
    let work_dir = tex_path.parent().ok_or_else(|| "无法获取 LaTeX 文件目录。".to_string())?;
    let stem = tex_path.file_stem().and_then(|v| v.to_str()).ok_or_else(|| "LaTeX 文件名无效。".to_string())?;
    let exts = ["aux", "bbl", "bcf", "blg", "fdb_latexmk", "fls", "log", "out", "run.xml", "synctex.gz", "toc"];
    let mut removed = 0;
    for ext in exts {
        let path = work_dir.join(format!("{stem}.{ext}"));
        if path.exists() {
            fs::remove_file(&path).map_err(|error| format!("无法删除 {}：{error}", path.display()))?;
            removed += 1;
        }
    }
    Ok(format!("已清理 {removed} 个 LaTeX 生成文件。"))
}

#[tauri::command]
fn open_pdf(path: String) -> Result<(), String> {
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
            write_text_file,
            save_text_file_with_dialog,
            set_secret,
            get_secret,
            delete_secret,
            open_external_url,
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
            find_latex_pdf,
            synctex_forward,
            synctex_reverse,
            clean_latex,
            open_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running markdown latex git desktop");
}
