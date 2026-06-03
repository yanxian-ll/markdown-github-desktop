use keyring::{Entry, Error as KeyringError};
use serde_json::{json, Value};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

const SERVICE_NAME: &str = "com.markdowngithub.desktop";

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
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| format!("无法读取文件 {path}：{error}"))
}

#[tauri::command]
fn write_text_file(path: String, text: String) -> Result<(), String> {
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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_app_state,
            save_app_state,
            read_text_file,
            write_text_file,
            set_secret,
            get_secret,
            delete_secret,
        ])
        .run(tauri::generate_context!())
        .expect("error while running markdown github desktop");
}
