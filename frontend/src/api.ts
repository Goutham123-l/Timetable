// In local dev this stays "/api" and Vite proxies it to localhost:5000.
// When deployed online, set VITE_API_URL (e.g. https://your-backend.onrender.com/api)
// in your hosting provider's environment variables and it will be used instead.
const BASE_URL = import.meta.env.VITE_API_URL || "/api";

function getToken() {
  return localStorage.getItem("token");
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const contentType = res.headers.get("content-type") || "";

  if (res.status === 401) {
    // Token missing/expired/invalid — clear the stale session and send the
    // user back to login instead of letting every request fail silently.
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new Error("Your session expired. Please log in again.");
  }

  if (!res.ok) {
    if (contentType.includes("application/json")) {
      const err = await res.json();
      throw new Error(err.message || "Request failed");
    }
    throw new Error("Request failed");
  }

  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: any) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path: string, body?: any) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: "DELETE" }),
};

export function downloadFile(path: string, filename: string) {
  const token = getToken();
  fetch(`${BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then((res) => res.blob())
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    });
}
