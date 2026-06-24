import axios from "axios";

let API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
if (!API_URL.endsWith("/v1")) {
  API_URL = API_URL + "/v1";
}

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add interceptor to inject Authorization header
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("synapse_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
