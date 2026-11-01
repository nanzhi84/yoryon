"use client";
import { useEffect, useRef, useState } from "react";
import type { SearchResponse } from "./format";

export function useStaticSearch(root: string, query: string, page: number) {
  const worker = useRef<Worker | null>(null);
  const sequence = useRef(0);
  const sentRetry = useRef(0);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ loading: boolean; result: SearchResponse | null; error: string | null }>({ loading: false, result: null, error: null });
  useEffect(() => {
    let instance: Worker;
    try {
      instance = new Worker(new URL("./worker.ts", import.meta.url));
      worker.current = instance;
    } catch {
      setState({ loading: false, result: null, error: "当前浏览器无法启动搜索，请重试或更换浏览器。" });
      return;
    }
    instance.onmessage = ({ data }: MessageEvent<SearchResponse>) => {
      if (data.request !== sequence.current) return;
      setState({ loading: false, result: data.error || !data.query ? null : data, error: data.error ?? null });
    };
    instance.onerror = () => setState({ loading: false, result: null, error: "搜索未能启动，请重试。" });
    return () => { instance.terminate(); worker.current = null; };
  }, [retry]);
  useEffect(() => {
    const request = ++sequence.current;
    if (!query.trim()) setState({ loading: false, result: null, error: null });
    else if (worker.current) setState({ loading: true, result: null, error: null });
    // Manual retry must bypass cached HTTP failures as well as the worker's parsed cache.
    const reload = sentRetry.current !== retry;
    sentRetry.current = retry;
    worker.current?.postMessage({ request, root, query, page, reload });
  }, [root, query, page, retry]);
  return { ...state, retry: () => setRetry(n => n + 1) };
}
