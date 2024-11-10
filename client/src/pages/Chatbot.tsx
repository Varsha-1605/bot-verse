import Separator from "@/components/Separator";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { deleteAllChats, fetchChatbotData } from "@/lib/queries";
import { messageSchema } from "@/lib/schemas";
import { SERVER_URL } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  ArrowLeft,
  Loader2,
  Menu,
  SendIcon,
  Sparkles,
  StopCircle,
  Mic,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import Markdown from "react-markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/contexts/settings-context";
import {
  useSettingsModal,
  useTranslateMagicModal,
  usettHMagic,
  useTtsMagicModal,
} from "@/stores/modal-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useSpeech from "@/hooks/useSpeech";
import EmojiPicker from "emoji-picker-react";
import exportFromJSON, { ExportType } from "export-from-json";
import { useTranslation } from "react-i18next";
import transition from "@/components/transition";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

function ChatbotPage() {
  const { id } = useParams();
  if (!id) return null;

  const { data } = useQuery({
    queryKey: ["chatbot", id],
    queryFn: () => fetchChatbotData(id),
  });
  const messageEl = useRef<HTMLDivElement | null>(null);
  const settingsModal = useSettingsModal();
  const ttsMagicModal = useTtsMagicModal();
  const ttHMagicModal = usettHMagic();
  const translateMagicModal = useTranslateMagicModal();
  const { currentConfig, readAloudEnabled } = useSettings();
  const [localreadAloudState, setLocalreadAloudState] =
    useState<boolean>(readAloudEnabled);
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const rq = useQueryClient();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof messageSchema>>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      query: "",
    },
  });

  const handleEmojiSelect = (emojiData: any) => {
    const currentValue = form.getValues("query");
    form.setValue("query", currentValue + emojiData.emoji); // Append selected emoji
    setShowEmojiPicker(false); // Close the picker after selecting
  };

  const mutation = useMutation({
    mutationFn: deleteAllChats,
    onSuccess: async () => {
      await rq.invalidateQueries({ queryKey: ["chatbot", id] });
    },
  });

  const scrollToBottom = useCallback(() => {
    if (messageEl.current) {
      // @ts-ignore
      messageEl.current.scrollTop = messageEl.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [data?.chats, scrollToBottom]);

  const { isRecording, toggleMicrophone, speak } = useSpeech((transcript) => {
    form.setValue("query", transcript);
    onSubmit({ query: transcript });
  });

  async function onSubmit(values: z.infer<typeof messageSchema>) {
    try {
      if (!values.query.trim()) return;
      if (currentConfig == null) {
        toast.error("Please Select AI engine in settings");
        return;
      }
      const token = localStorage.getItem("token");

      const authHeaders = {
        Authorization: `Bearer ${token || ""}`,
        Apikey: currentConfig.apiKey,
        engine: currentConfig.engine,
      };
      setLoading(true);
      const response = await axios.post(
        `${SERVER_URL}/api/chatbot/${id}`,
        values,
        {
          headers: authHeaders,
        }
      );
      if (response.data?.success) {
        form.reset();
        rq.invalidateQueries({ queryKey: ["chatbot", id] });
        if (localreadAloudState) {
          speak(response.data.response);
        }
      } else {
        throw new Error(response.data?.message || "failed. Please try again.");
      }
    } catch (error: any) {
      toast.error("Check your API key and try again");
      console.log("[MESSAGING_ERROR]", error);
    } finally {
      setLoading(false);
    }
  }

  const handleExport = (exportType: ExportType) => {
    if (!data) return;

    const chats = data.chats.map((chat) => ({
      User: chat.user_query,
      Response: chat.response,
    }));

    const fileName = "chatbot_conversation";

    switch (exportType) {
      case "csv":
        exportFromJSON({ data: chats, fileName, exportType: "csv" });
        break;
      case "json":
        exportFromJSON({ data: chats, fileName, exportType: "json" });
        break;
      case "html":
        const htmlData = `
          <table>
            <tr><th>User</th><th>Response</th></tr>
            ${chats
              .map(
                (chat) =>
                  `<tr><td>${chat.User}</td><td>${chat.Response}</td></tr>`
              )
              .join("")}
          </table>`;
        exportFromJSON({ data: htmlData, fileName, exportType: "html" });
        break;
      case "xml":
        // Converting to XML structure
        const xmlData = `<conversations>
          ${chats
            .map(
              (chat) =>
                `<chat><User>${chat.User}</User><Response>${chat.Response}</Response></chat>`
            )
            .join("")}
        </conversations>`;
        exportFromJSON({ data: xmlData, fileName, exportType: "txt" });
        break;
      default:
        exportFromJSON({ data: chats, fileName, exportType }); // Default export
    }
  };

  return (
    <div className="flex flex-col border-x-2 border-lighter dark:border-darker max-w-7xl mx-auto rounded-sm dark:bg-dark bg-light dark:text-dark h-screen">
      <div className="flex items-center justify-between m-3">
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => navigate(-1)}
            variant={"outline"}
            size={"icon"}
            className="rounded-full"
          >
            <ArrowLeft className="w-10 h-10" />
          </Button>
          {!data ? (
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            </div>
          ) : (
            <Link to={`/hub/${data?.bot.id}`} className="flex">
              <img
                src={data?.bot.avatar}
                alt={`${data?.bot.latest_version.name}'s avatar`}
                className="w-10 h-10 border rounded-full dark:border-darker mr-3"
              />
              <h1 className="text-4xl font-extrabold dark:text-dark text-center">
                {data?.bot.latest_version.name}
              </h1>
            </Link>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="voice-mode">Read Aloud</Label>
          <Switch
            id="voice-mode"
            checked={localreadAloudState}
            onCheckedChange={(b) => setLocalreadAloudState(b)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Menu />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="mr-8">
              <DropdownMenuItem onClick={() => settingsModal.onOpen()}>
                {t("navbar.settings")}
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {t("chatbot_page.export")}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => handleExport(exportFromJSON.types.csv)}
                    >
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleExport(exportFromJSON.types.json)}
                    >
                      JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleExport(exportFromJSON.types.html)}
                    >
                      HTML
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleExport(exportFromJSON.types.xml)}
                    >
                      XML
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive hover:text-destructive/90"
                onClick={() => {
                  mutation.mutate(id);
                }}
              >
                {t("clear")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Separator className="my-0" />

      <div
        id="content"
        ref={messageEl}
        className="flex-1 overflow-y-auto w-full h-full no-scrollbar"
      >
        {data ? (
          data.chats.map((chat) => (
            <div key={chat.id}>
              <div className="flex justify-end m-2">
                <div className="bg-secondary rounded-full p-4">
                  <p className="text-sm text-secondary-foreground">
                    {chat.user_query}
                  </p>
                </div>
              </div>
              <div className="flex items-start justify-start py-3">
                <img
                  src={data?.bot.avatar}
                  alt={`${data?.bot.latest_version.name}'s avatar`}
                  className="w-10 h-10 border rounded-full mx-4"
                />

                <div className="mr-4">
                  <Markdown className="text-sm">{chat.response}</Markdown>
                  <div className="flex justify-start py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button
                          className="rounded-full hover:bg-primary/10 bg-primary/5"
                          variant={"ghost"}
                          size={"icon"}
                        >
                          <Sparkles className="text-primary" />
                          <span className="sr-only">
                            {t("chatbot_page.action")}
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() =>
                            translateMagicModal.onOpen({
                              text: chat.response,
                            })
                          }
                        >
                          {t("chatbot_page.translate")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            ttsMagicModal.onOpen({
                              text: chat.response,
                            })
                          }
                        >
                          {t("chatbot_page.listen")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            ttHMagicModal.onOpen({
                              text: chat.response,
                            })
                          }
                        >
                          Handwriting
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <Loading />
        )}
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full space-x-3 px-3 py-1 border-t dark:border-darker border-lighter"
        >
          <FormField
            control={form.control}
            disabled={loading}
            name="query"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <Input
                    className="w-full"
                    placeholder={t("message.ph")}
                    {...field}
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 bg-gray-200 rounded-full"
          >
            😊
          </Button>
          {showEmojiPicker && (
            <div className="absolute left-1/2 bottom-full w-1 h-1 transform -translate-x-1/2 translate-y-52">
              <EmojiPicker onEmojiClick={handleEmojiSelect} />
            </div>
          )}
          <Button
            type="button"
            size={"icon"}
            variant={"outline"}
            onClick={toggleMicrophone}
          >
            {isRecording ? <StopCircle /> : <Mic />}
          </Button>
          <Button
            type="submit"
            size={"icon"}
            variant={"outline"}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" /> : <SendIcon />}
          </Button>
        </form>
      </Form>
    </div>
  );
}

function Loading() {
  return (
    <div>
      <p className="text-muted-foreground">Loading previous data..</p>
    </div>
  );
}

export default transition(ChatbotPage);
