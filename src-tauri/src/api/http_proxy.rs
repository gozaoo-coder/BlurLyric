/**
 * HTTP 代理模块
 * 
 * 为前端提供 HTTP 请求代理功能，避免 CORS 问题
 * 所有网络请求通过 Tauri IPC 由后端代理执行
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpRequest {
    pub url: String,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub headers: Option<HashMap<String, String>>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub timeout: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub ok: bool,
}

/// 执行 HTTP 请求
pub async fn execute_request(request: HttpRequest) -> Result<HttpResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(request.timeout.unwrap_or(30)))
        .user_agent("BlurLyric/3.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let method = match request.method.as_deref() {
        Some("POST") => reqwest::Method::POST,
        Some("PUT") => reqwest::Method::PUT,
        Some("DELETE") => reqwest::Method::DELETE,
        Some("PATCH") => reqwest::Method::PATCH,
        Some("HEAD") => reqwest::Method::HEAD,
        _ => reqwest::Method::GET,
    };

    let mut req = client.request(method, &request.url);

    // 添加请求头
    if let Some(headers) = &request.headers {
        for (key, value) in headers {
            req = req.header(key, value);
        }
    }

    // 添加请求体
    if let Some(body) = &request.body {
        req = req.body(body.clone());
    }

    // 执行请求
    let response = req
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    // 提取响应头
    let mut headers = HashMap::new();
    for (key, value) in response.headers() {
        if let Ok(v) = value.to_str() {
            headers.insert(key.to_string(), v.to_string());
        }
    }

    // 获取响应状态
    let status = response.status().as_u16();
    let ok = response.status().is_success();

    // 获取响应体
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    Ok(HttpResponse {
        status,
        headers,
        body,
        ok,
    })
}

/// Tauri IPC 命令：执行 HTTP 请求
#[tauri::command]
pub async fn http_request(request: HttpRequest) -> Result<HttpResponse, String> {
    execute_request(request).await
}

/// Tauri IPC 命令：执行 GET 请求（简化版）
#[tauri::command]
pub async fn http_get(url: String) -> Result<HttpResponse, String> {
    let request = HttpRequest {
        url,
        method: Some("GET".to_string()),
        headers: None,
        body: None,
        timeout: Some(30),
    };
    execute_request(request).await
}

/// Tauri IPC 命令：执行 POST 请求（简化版）
#[tauri::command]
pub async fn http_post(url: String, body: String) -> Result<HttpResponse, String> {
    let mut headers = HashMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());
    
    let request = HttpRequest {
        url,
        method: Some("POST".to_string()),
        headers: Some(headers),
        body: Some(body),
        timeout: Some(30),
    };
    execute_request(request).await
}
