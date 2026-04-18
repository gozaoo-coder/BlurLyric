//! 窗口控制命令模块
//! 
//! 包含窗口关闭、最小化、最大化、置顶等操作

use std::sync::Mutex;
use once_cell::sync::Lazy;

/// 窗口置顶状态
static ALWAYS_ON_TOP_STATE: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

/// 关闭应用窗口
#[tauri::command]
pub fn close_app(window: tauri::Window) {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let _ = window.close();
    }
}

/// 最小化窗口
#[tauri::command]
pub async fn minimize_window(window: tauri::Window) {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let _ = window.minimize();
    }
}

/// 切换窗口最大化/还原状态
#[tauri::command]
pub async fn toggle_maximize(window: tauri::Window) {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        if window.is_maximized().unwrap_or(false) {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

/// 切换窗口始终置顶状态
#[tauri::command]
pub async fn toggle_always_on_top(window: tauri::Window) -> Result<bool, String> {
    let new_state = {
        let mut state = ALWAYS_ON_TOP_STATE.lock().map_err(|e| e.to_string())?;
        *state = !*state;
        *state
    };
    
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        window
            .set_always_on_top(new_state)
            .map_err(|e| e.to_string())?;
    }
    
    Ok(new_state)
}
