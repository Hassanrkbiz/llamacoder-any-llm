"use client";

import CodeViewer from "@/components/code-viewer";
import { useScrollTo } from "@/hooks/use-scroll-to";
import { domain } from "@/utils/domain";
import { CheckIcon } from "@heroicons/react/16/solid";
import {
  ArrowLongRightIcon,
  ChevronDownIcon,
  PhotoIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import { ArrowUpOnSquareIcon } from "@heroicons/react/24/outline";
import * as Select from "@radix-ui/react-select";
import * as Switch from "@radix-ui/react-switch";
import * as Tooltip from "@radix-ui/react-tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useEffect, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import LoadingDots from "../../components/loading-dots";
import { shareApp } from "./actions";
import {
  DEFAULT_LLM,
  DEFAULT_PROVIDER,
  llms,
  SHADCN,
  getModelList,
} from "@/utils/llms";
import { ModelInfo } from "@/utils/llms.type";

export default function Home() {
  let [status, setStatus] = useState<
    "initial" | "creating" | "created" | "updating" | "updated"
  >("initial");
  let [prompt, setPrompt] = useState("");
  let [provider, setProvider] = useState(DEFAULT_LLM.provider);
  console.log('pprovider', provider);
  let [model, setModel] = useState(DEFAULT_LLM.name);
  console.log('mmodel', model);
  let [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  let [apiKeys, setApiKeys] = useState({
    OpenAI: "",
    Anthropic: "",
    Groq: "",
    OpenRouter: "",
    Google: "",
    OpenAILike: "",
    Deepseek: "",
    Mistral: "",
    LMStudio: "",
    xAI: "",
    Together: "",
    HuggingFace: "",
    Ollama: "",
    Cohere: "",
  });
    // Load saved values from localStorage after component mounts (client-side only)
  useEffect(() => {
    const savedProvider = localStorage.getItem("selectedProvider");
    const savedModel = localStorage.getItem("selectedModel");
    
    if (savedProvider) setProvider(savedProvider);
    if (savedModel) setModel(savedModel);
  }, []); // Empty dependency array = runs only once on mount

  // Save to localStorage when provider or model changes
  useEffect(() => {
    localStorage.setItem("selectedProvider", provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem("selectedModel", model);
  }, [model]);
  let [apiKey, setApiKey] = useState("");
  let [shadcn, setShadcn] = useState(false);
  let [modification, setModification] = useState("");
  let [generatedCode, setGeneratedCode] = useState("");
  let [providers, setProviders] = useState<ModelInfo[]>([]);
  let [models, setModels] = useState<ModelInfo[]>([]);
  let [modelList, setModelList] = useState<ModelInfo[]>([]);
  let [initialAppConfig, setInitialAppConfig] = useState({
    model: DEFAULT_LLM.name,
    shadcn: SHADCN,
    provider: DEFAULT_PROVIDER.name,
  });
  let [ref, scrollTo] = useScrollTo();
  let [messages, setMessages] = useState<{ role: string; content: string }[]>(
    [],
  );
  let [isPublishing, setIsPublishing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<{
    name: string;
    url: string;
    contentType: string;
  } | null>(null);

  let loading = status === "creating" || status === "updating";

  useEffect(() => {
    filterModels(provider);
  }, [provider]);

  useEffect(() => {
    if(!models.length){
      return;
    }
    console.log("selectedModel", model);
    console.log("models", models);
    let modelAvail = models.find((m) => m.name === model);
    console.log("modelAvail", modelAvail);
    if (modelAvail) {
      setSelectedModel(modelAvail);
      setModel(modelAvail.name);
    } else {
      setModel(models[0]?.name ?? DEFAULT_LLM.name);
      setSelectedModel(models[0] ?? DEFAULT_LLM);
    }
  }, [models]);

  useEffect(() => {
    if (!selectedModel?.imageSupport) {
      setImageFile(null);
      setImageUrl(null);
    }
  }, [selectedModel]);

  useEffect(() => {
    let uniqueProviders = new Set();
    let filteredProviders: ModelInfo[] = modelList.filter((provider) => {
      if (!uniqueProviders.has(provider.provider)) {
        uniqueProviders.add(provider.provider);
        return true;
      }
      return false;
    });

    // console.log('filteredProviders', filteredProviders);
    setProviders(filteredProviders);
    filterModels(provider);
  }, [modelList]);

  useEffect(() => {
    getModelList({}).then((modelList) => {
      console.log("modelList", modelList);
      setModelList(modelList);
    });
  }, []);

  const getModelObj = (model: string) => {
    return modelList.find((m) => m.name === model) ?? DEFAULT_LLM;
  };

  function filterModels(provider: string) {
    let uniqueModels = new Set();
    let filteredModels: ModelInfo[] = modelList.filter((model) => {
      if (!uniqueModels.has(model.name) && model.provider === provider) {
        uniqueModels.add(model.name);
        return true;
      }
      return false;
    });
    // console.log('filteredModels', filteredModels);
    setModels(filteredModels);
    // console.log('main model', filteredModels[0]?.name ?? DEFAULT_LLM);
  }

  const codeBuffer = useRef(""); // Buffer to accumulate code
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Ref for debounce timeout
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
        setImageFile({
          name: file.name,
          url: reader.result as string,
          contentType: file.type,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  async function createApp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    codeBuffer.current = "";

    if (status !== "initial") {
      scrollTo({ delay: 0.5 });
    }

    setStatus("creating");
    setGeneratedCode("");

    let res = await fetch("/api/generateCode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        shadcn,
        apiKeys,
        messages: [{ role: "user", content: prompt }],
        provider,
        imageFile,
      }),
    });

    if (!res.ok) {
      throw new Error(res.statusText);
    }

    if (!res.body) {
      throw new Error("No response body");
    }

    let reader = res.body.getReader();
    let decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      if (doneReading) {
        done = true;
        setMessages([{ role: "user", content: prompt }]);
        setInitialAppConfig({ model, shadcn, provider });
        setStatus("created");
        break;
      }

      const chunkValue = decoder.decode(value);
      codeBuffer.current += chunkValue; // Accumulate chunks

      // Debounce the state update
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        let code = parseCode(codeBuffer.current);
        setGeneratedCode(code); // Update state with accumulated code
      }, 5); // Adjust the delay as needed
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  async function updateApp(e: FormEvent<HTMLFormElement>) {
    codeBuffer.current = "";
    e.preventDefault();

    setStatus("updating");

    let codeMessage = { role: "assistant", content: generatedCode };
    let modificationMessage = { role: "user", content: modification };

    setGeneratedCode("");

    const res = await fetch("/api/generateCode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [...messages, codeMessage, modificationMessage],
        model: model,
        shadcn: initialAppConfig.shadcn,
        apiKeys,
        provider,
        imageFile,
      }),
    });

    if (!res.ok) {
      throw new Error(res.statusText);
    }

    if (!res.body) {
      throw new Error("No response body");
    }

    let reader = res.body.getReader();
    let decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      if (doneReading) {
        done = true;
        setMessages((m) => [...m, codeMessage, modificationMessage]);
        setStatus("updated");
        break;
      }

      const chunkValue = decoder.decode(value);
      codeBuffer.current += chunkValue; // Accumulate chunks

      // Debounce the state update
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        let code = parseCode(codeBuffer.current);
        setGeneratedCode(code); // Update state with accumulated code
      }, 5); // Adjust the delay as needed
    }
  }

  useEffect(() => {
    let el = document.querySelector(".cm-scroller");
    if (el && loading) {
      let end = el.scrollHeight - el.clientHeight;
      el.scrollTo({ top: end });
    }
  }, [loading, generatedCode]);

  const parseCode = (text: string): string => {
    const patterns = [
      // @ts-ignore
      /```(javascript|typescript|googlescript|js|ts|gs|html|json)/gs,
      // @ts-ignore
      /(```)$/gm,
    ];

    let newCode = text.replace(patterns[0], "").replace(patterns[1], "");

    newCode = newCode.trim();

    // If no matches were found, return the whole input as a single-element array
    return newCode;
  };

  const appendApiKey = (key: string) => {
    setApiKeys({
      ...apiKeys,
      [provider]: key,
    });

    setApiKey(key);
  };

  return (
    <main className="mt-12 flex w-full flex-1 flex-col items-center px-4 text-center sm:mt-20">
      {/* <a
        className="mb-4 inline-flex h-7 shrink-0 items-center gap-[9px] rounded-[50px] border-[0.5px] border-solid border-[#E6E6E6] bg-[rgba(234,238,255,0.65)] bg-gray-100 px-7 py-5 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.25)]"
        href="https://dub.sh/together-ai/?utm_source=example-app&utm_medium=llamacoder&utm_campaign=llamacoder-app-signup"
        target="_blank"
      >
        <span className="text-center">
          Powered by <span className="font-medium">Llama</span> and{" "}
          <span className="font-medium">Together AI</span>
        </span>
      </a> */}
      <h1 className="my-6 max-w-3xl text-4xl font-bold text-gray-800 sm:text-6xl">
        Turn your <span className="text-blue-600">idea</span>
        <br /> into an <span className="text-blue-600">app</span>
      </h1>

      <form
        className="mx-auto flex w-full max-w-xl flex-col items-center"
        onSubmit={createApp}
      >
        <fieldset disabled={loading} className="w-full disabled:opacity-75">
          <div className="relative mt-5">
            <div className="absolute -inset-2 rounded-[32px] bg-gray-300/50" />
            <div className="relative flex rounded-3xl bg-white shadow-sm">
              <div className="relative flex flex-grow items-stretch focus-within:z-10">
                {imageUrl && (
                  <div className="relative flex items-center justify-center rounded-md p-4">
                    <div className="relative">
                      <img
                        src={imageUrl}
                        alt="Uploaded preview"
                        className="h-24 w-24 rounded object-cover shadow"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageUrl(null);
                          setImageFile(null);
                        }}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-gray-800 shadow hover:bg-red-500 hover:text-white"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
                <textarea
                  rows={3}
                  required
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e: any) => {
                    // submit the form on enter
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      createApp(e);
                    }
                  }}
                  name="prompt"
                  className="w-full resize-none rounded-l-3xl bg-transparent px-6 py-5 text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                  placeholder="Build me a calculator app..."
                />
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                ref={fileInputRef}
                style={{ display: "none", visibility: "hidden" }}
              />
              {selectedModel?.imageSupport && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => fileInputRef?.current?.click()}
                  className="relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-3xl px-3 py-2 text-sm font-semibold text-blue-500 hover:text-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:text-gray-900"
                >
                  {status === "creating" ? (
                    <LoadingDots color="black" style="large" />
                  ) : (
                    <PhotoIcon className="-ml-0.5 size-6" />
                  )}
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-3xl px-3 py-2 text-sm font-semibold text-blue-500 hover:text-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:text-gray-900"
              >
                {status === "creating" ? (
                  <LoadingDots color="black" style="large" />
                ) : (
                  <ArrowLongRightIcon className="-ml-0.5 size-6" />
                )}
              </button>
            </div>
          </div>
          <div className="mt-6 flex w-full flex-col items-center justify-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
            <div className="flex items-center justify-center gap-3">
              <p className="text-gray-500 sm:text-xs">Provider:</p>
              <Select.Root
                name="provider"
                disabled={loading}
                value={provider}
                onValueChange={(value) => {
                  setProvider(value);
                  localStorage.setItem("selectedProvider", value);
                }}
              >
                <Select.Trigger className="group flex w-60 max-w-xs items-center rounded-2xl border-[6px] border-gray-300 bg-white px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
                  <Select.Value />
                  <Select.Icon className="ml-auto">
                    <ChevronDownIcon className="size-6 text-gray-300 group-focus-visible:text-gray-500 group-enabled:group-hover:text-gray-500" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="overflow-hidden rounded-md bg-white shadow-lg">
                    <Select.Viewport className="p-2">
                      {providers.map((model) => (
                        <Select.Item
                          key={model.provider}
                          value={model.provider}
                          className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm data-[highlighted]:bg-gray-100 data-[highlighted]:outline-none"
                        >
                          <Select.ItemText asChild>
                            <span className="inline-flex items-center gap-2 text-gray-500">
                              <div className="size-2 rounded-full bg-green-500" />
                              {model.provider}
                            </span>
                          </Select.ItemText>
                          <Select.ItemIndicator className="ml-auto">
                            <CheckIcon className="size-5 text-blue-600" />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                    <Select.ScrollDownButton />
                    <Select.Arrow />
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
            <div className="flex items-center justify-center gap-3">
              <p className="text-gray-500 sm:text-xs">Model:</p>
              <Select.Root
                name="model"
                disabled={loading}
                value={model}
                onValueChange={(value) => {
                  console.log("model", value);
                  if (value.trim() !== "") {
                    setModel(value);
                    let modelObj = getModelObj(value);
                    setSelectedModel(modelObj);
                    localStorage.setItem("selectedModel", value);
                  }
                }}
              >
                <Select.Trigger className="group flex w-60 max-w-xs items-center rounded-2xl border-[6px] border-gray-300 bg-white px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
                  <Select.Value />
                  <Select.Icon className="ml-auto">
                    <ChevronDownIcon className="size-6 text-gray-300 group-focus-visible:text-gray-500 group-enabled:group-hover:text-gray-500" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="overflow-hidden rounded-md bg-white shadow-lg">
                    <Select.Viewport className="p-2">
                      {models.map((model) => (
                        <Select.Item
                          key={model.name}
                          value={model.name}
                          className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm data-[highlighted]:bg-gray-100 data-[highlighted]:outline-none"
                        >
                          <Select.ItemText asChild>
                            <span className="inline-flex items-center gap-2 text-gray-500">
                              <div className="size-2 rounded-full bg-green-500" />
                              {model.label}
                            </span>
                          </Select.ItemText>
                          <Select.ItemIndicator className="ml-auto">
                            <CheckIcon className="size-5 text-blue-600" />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                    <Select.ScrollDownButton />
                    <Select.Arrow />
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            {/* <div className="flex items-center justify-center gap-3">
              <p className="text-gray-500 sm:text-xs">API Key:</p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => appendApiKey(e.target.value)}
                className="group flex w-60 max-w-xs items-center rounded-2xl border-[6px] border-gray-300 bg-white px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                placeholder="Enter API key"
              />
            </div> */}

            <div className="flex h-full items-center justify-between gap-3">
              <label className="text-gray-500 sm:text-xs" htmlFor="shadcn">
                shadcn/ui:
              </label>
              <Switch.Root
                className="group flex w-20 max-w-xs items-center rounded-2xl border-[6px] border-gray-300 bg-white p-1.5 text-sm shadow-inner transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 data-[state=checked]:bg-blue-500"
                id="shadcn"
                name="shadcn"
                checked={shadcn}
                onCheckedChange={(value) => setShadcn(value)}
              >
                <Switch.Thumb className="size-7 rounded-lg bg-gray-200 shadow-[0_1px_2px] shadow-gray-400 transition data-[state=checked]:translate-x-7 data-[state=checked]:bg-white data-[state=checked]:shadow-gray-600" />
              </Switch.Root>
            </div>
          </div>
        </fieldset>
      </form>

      <hr className="border-1 mb-20 h-px bg-gray-700 dark:bg-gray-700" />

      {status !== "initial" && (
        <motion.div
          initial={{ height: 0 }}
          animate={{
            height: "auto",
            overflow: "hidden",
            transitionEnd: { overflow: "visible" },
          }}
          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
          className="w-full pb-[25vh] pt-10"
          onAnimationComplete={() => scrollTo()}
          ref={ref}
        >
          <div className="mt-5 flex gap-4">
            <form className="w-full" onSubmit={updateApp}>
              <fieldset disabled={loading} className="group">
                <div className="relative">
                  <div className="relative flex rounded-3xl bg-white shadow-sm group-disabled:bg-gray-50">
                    <div className="relative flex flex-grow items-stretch focus-within:z-10">
                      <input
                        required
                        name="modification"
                        value={modification}
                        onChange={(e) => setModification(e.target.value)}
                        onKeyDown={(e: any) => {
                          // submit the form on enter
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            updateApp(e);
                          }
                        }}
                        className="w-full rounded-l-3xl bg-transparent px-6 py-5 text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed"
                        placeholder="Make changes to your app here"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-3xl px-3 py-2 text-sm font-semibold text-blue-500 hover:text-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:text-gray-900"
                    >
                      {loading ? (
                        <LoadingDots color="black" style="large" />
                      ) : (
                        <ArrowLongRightIcon className="-ml-0.5 size-6" />
                      )}
                    </button>
                  </div>
                </div>
              </fieldset>
            </form>
            <div>
              <Toaster invert={true} />
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      disabled={loading || isPublishing}
                      onClick={async () => {
                        setIsPublishing(true);
                        let userMessages = messages.filter(
                          (message) => message.role === "user",
                        );
                        let prompt =
                          userMessages[userMessages.length - 1].content;

                        const appId = await minDelay(
                          shareApp({
                            generatedCode,
                            prompt,
                            model: model,
                          }),
                          1000,
                        );
                        setIsPublishing(false);
                        toast.success(
                          `Your app has been published & copied to your clipboard! llamacoder.io/share/${appId}`,
                        );
                        navigator.clipboard.writeText(
                          `${domain}/share/${appId}`,
                        );
                      }}
                      className="inline-flex h-[68px] w-40 items-center justify-center gap-2 rounded-3xl bg-blue-500 transition enabled:hover:bg-blue-600 disabled:grayscale"
                    >
                      <span className="relative">
                        {isPublishing && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <LoadingDots color="white" style="large" />
                          </span>
                        )}

                        <ArrowUpOnSquareIcon
                          className={`${isPublishing ? "invisible" : ""} size-5 text-xl text-white`}
                        />
                      </span>

                      <p className="text-lg font-medium text-white">
                        Publish app
                      </p>
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="select-none rounded bg-white px-4 py-2.5 text-sm leading-none shadow-md shadow-black/20"
                      sideOffset={5}
                    >
                      Publish your app to the internet.
                      <Tooltip.Arrow className="fill-white" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            </div>
          </div>
          <div className="relative mt-8 w-full overflow-hidden">
            <div className="isolate">
              <CodeViewer code={generatedCode} showEditor />
            </div>

            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={status === "updating" ? { x: "100%" } : undefined}
                  animate={status === "updating" ? { x: "0%" } : undefined}
                  exit={{ x: "100%" }}
                  transition={{
                    type: "spring",
                    bounce: 0,
                    duration: 0.85,
                    delay: 0.5,
                  }}
                  className="absolute inset-x-0 bottom-0 top-1/2 flex items-center justify-center rounded-r border border-gray-400 bg-gradient-to-br from-gray-100 to-gray-300 md:inset-y-0 md:left-1/2 md:right-0"
                >
                  <p className="animate-pulse text-3xl font-bold">
                    {status === "creating"
                      ? "Building your app..."
                      : "Updating your app..."}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </main>
  );
}

async function minDelay<T>(promise: Promise<T>, ms: number) {
  let delay = new Promise((resolve) => setTimeout(resolve, ms));
  let [p] = await Promise.all([promise, delay]);

  return p;
}
