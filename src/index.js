import { request as stealthRequest } from "stealth-fetch/web";

const TARGET_API = "https://index-translate.bilibili.com/v1/chat/completions";

export default {
  async fetch(req, env, ctx) {
    // 处理 CORS 预检
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 只接受 POST
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "请使用 POST 请求" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // 未配置密钥时拒绝服务，避免部署后意外开放。
    if (!env.API_KEY) {
      return Response.json({ error: "请配置 API_KEY" }, {
        status: 503, headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
    const encoder = new TextEncoder();
    const expected = encoder.encode("Bearer " + env.API_KEY);
    const actual = encoder.encode(req.headers.get("Authorization") || "");
    if (actual.length !== expected.length || !crypto.subtle.timingSafeEqual(actual, expected)) {
      return Response.json({ error: "API Key 无效" }, {
        status: 401, headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // 解析请求体
    let body;
    try {
      const text = await req.text();
      if (!text.trim()) {
        throw new Error("请求体为空");
      }
      body = JSON.parse(text);
    } catch (err) {
      return new Response(JSON.stringify({ error: `JSON 解析失败: ${err.message}` }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    try {
      // 使用 stealth-fetch 转发请求
      const apiResponse = await stealthRequest(TARGET_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: JSON.stringify(body),
      });

      // 构造返回响应
      const response = new Response(apiResponse.body, apiResponse);
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "*");

      return response;
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};
