/**
 * HTTP 代理模块
 *
 * 为前端提供 HTTP 请求代理功能，避免 CORS 问题
 * 所有网络请求通过 Tauri IPC 由后端代理执行
 */
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, error, info, warn};

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
    let method = request.method.as_deref().unwrap_or("GET");
    debug!("Executing HTTP {} request to: {}", method, request.url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(
            request.timeout.unwrap_or(30),
        ))
        .user_agent("BlurLyric/3.0")
        .build()
        .map_err(|e| {
            error!("Failed to create HTTP client: {}", e);
            format!("Failed to create HTTP client: {}", e)
        })?;

    let method = match request.method.as_deref() {
        Some("POST") => reqwest::Method::POST,
        Some("PUT") => reqwest::Method::PUT,
        Some("DELETE") => reqwest::Method::DELETE,
        Some("PATCH") => reqwest::Method::PATCH,
        Some("HEAD") => reqwest::Method::HEAD,
        _ => reqwest::Method::GET,
    };
    let method_str = method.to_string();

    let mut req = client.request(method, &request.url);

    // 添加请求头
    if let Some(headers) = &request.headers {
        debug!("Adding headers: {:?}", headers);
        for (key, value) in headers {
            req = req.header(key, value);
        }
    }

    // 添加请求体
    if let Some(body) = &request.body {
        debug!("Adding request body (length: {} bytes)", body.len());
        req = req.body(body.clone());
    }

    // 执行请求
    let response = req.send().await.map_err(|e| {
        error!("HTTP request failed: {}", e);
        format!("HTTP request failed: {}", e)
    })?;

    // 获取响应状态
    let status = response.status().as_u16();
    let ok = response.status().is_success();

    if ok {
        info!("HTTP request successful: {} {}", method_str, request.url);
    } else {
        warn!(
            "HTTP request failed with status: {} for {} {}",
            status, method_str, request.url
        );
    }

    // 提取响应头
    let mut headers = HashMap::new();
    for (key, value) in response.headers() {
        if let Ok(v) = value.to_str() {
            headers.insert(key.to_string(), v.to_string());
        }
    }

    // 获取响应体
    let body = response.text().await.map_err(|e| {
        error!("Failed to read response body: {}", e);
        format!("Failed to read response body: {}", e)
    })?;

    debug!(
        "Response received: status={}, body_length={} bytes",
        status,
        body.len()
    );

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

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::test;

    #[test]
    async fn test_http_request_struct() {
        let request = HttpRequest {
            url: "https://example.com".to_string(),
            method: Some("GET".to_string()),
            headers: None,
            body: None,
            timeout: Some(10),
        };

        assert_eq!(request.url, "https://example.com");
        assert_eq!(request.method, Some("GET".to_string()));
        assert_eq!(request.timeout, Some(10));
    }

    #[test]
    async fn test_http_response_struct() {
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());

        let response = HttpResponse {
            status: 200,
            headers,
            body: "{\"message\": \"ok\"}".to_string(),
            ok: true,
        };

        assert_eq!(response.status, 200);
        assert_eq!(response.ok, true);
        assert_eq!(response.body, "{\"message\": \"ok\"}");
    }
}
