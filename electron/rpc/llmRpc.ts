import path from "node:path";
import {BrowserWindow, dialog} from "electron";
import {createElectronSideBirpc} from "../utils/createElectronSideBirpc.ts";
import {llmFunctions, llmState} from "../state/llmState.ts";
import {resolveModelDirectory} from "../settings.ts";
import type {RenderedFunctions} from "../../src/rpc/llmRpc.ts";

export class ElectronLlmRpc {
    public readonly rendererLlmRpc: ReturnType<typeof createElectronSideBirpc<RenderedFunctions, typeof this.functions>>;

    public readonly functions = {
        async selectModelDirectory() {
            const res = await dialog.showOpenDialog({
                message: "Select the folder where your model files are stored",
                title: "Select model directory",
                buttonLabel: "Use this folder",
                defaultPath: resolveModelDirectory(),
                properties: ["openDirectory", "createDirectory"]
            });

            if (!res.canceled && res.filePaths.length > 0)
                llmFunctions.setModelDirectory(path.resolve(res.filePaths[0]!));
        },
        async selectModelFile() {
            const res = await dialog.showOpenDialog({
                message: "Select a model file",
                title: "Select a model file",
                filters: [
                    {name: "Model file", extensions: ["gguf"]}
                ],
                buttonLabel: "Select",
                defaultPath: resolveModelDirectory(),
                properties: ["openFile"]
            });

            if (!res.canceled && res.filePaths.length > 0)
                llmFunctions.setSavedModelPath(path.resolve(res.filePaths[0]!));
        },
        loadSelectedModel: llmFunctions.loadSavedModel,
        async selectEmbeddingModelFile() {
            const res = await dialog.showOpenDialog({
                message: "Select an embedding model file",
                title: "Select an embedding model file",
                filters: [
                    {name: "Model file", extensions: ["gguf"]}
                ],
                buttonLabel: "Select",
                defaultPath: resolveModelDirectory(),
                properties: ["openFile"]
            });

            if (!res.canceled && res.filePaths.length > 0)
                llmFunctions.setSavedEmbeddingModelPath(path.resolve(res.filePaths[0]!));
        },
        loadSelectedEmbeddingModel: llmFunctions.loadSavedEmbeddingModel,
        async ingestDocumentFile() {
            const res = await dialog.showOpenDialog({
                message: "Select a document to add to the knowledge base",
                title: "Select a document",
                filters: [
                    {name: "Text/Markdown", extensions: ["txt", "md"]}
                ],
                buttonLabel: "Add",
                defaultPath: resolveModelDirectory(),
                properties: ["openFile"]
            });

            if (!res.canceled && res.filePaths.length > 0)
                return await llmFunctions.ingestDocument(path.resolve(res.filePaths[0]!));

            return undefined;
        },
        clearRag: llmFunctions.clearRag,
        deleteRagDocument: llmFunctions.deleteRagDocument,
        getState() {
            return llmState.state;
        },
        setActiveProvider: llmFunctions.setActiveProvider,
        setModelDirectory: llmFunctions.setModelDirectory,
        setLocalTemperature: llmFunctions.setLocalTemperature,
        setLocalContextSize: llmFunctions.setLocalContextSize,
        setSystemPrompt: llmFunctions.setSystemPrompt,
        setOpenAiApiKey: llmFunctions.setOpenAiApiKey,
        clearOpenAiApiKey: llmFunctions.clearOpenAiApiKey,
        setOpenAiModel: llmFunctions.setOpenAiModel,
        setAnthropicApiKey: llmFunctions.setAnthropicApiKey,
        clearAnthropicApiKey: llmFunctions.clearAnthropicApiKey,
        setAnthropicModel: llmFunctions.setAnthropicModel,
        setGeminiApiKey: llmFunctions.setGeminiApiKey,
        clearGeminiApiKey: llmFunctions.clearGeminiApiKey,
        setGeminiModel: llmFunctions.setGeminiModel,
        addMcpServer: llmFunctions.addMcpServer,
        removeMcpServer: llmFunctions.removeMcpServer,
        setMcpServerEnabled: llmFunctions.setMcpServerEnabled,
        setLocalMcpServerEnabled: llmFunctions.setLocalMcpServerEnabled,
        setRagEnabled: llmFunctions.setRagEnabled,
        setDraftPrompt: llmFunctions.chatSession.setDraftPrompt,
        prompt: llmFunctions.chatSession.prompt,
        stopActivePrompt: llmFunctions.chatSession.stopActivePrompt,
        resetChatHistory: llmFunctions.chatSession.resetChatHistory,
        newSession: llmFunctions.newSession,
        switchSession: llmFunctions.switchSession,
        deleteSession: llmFunctions.deleteSession,
        renameSession: llmFunctions.renameSession
    } as const;

    public constructor(window: BrowserWindow) {
        this.rendererLlmRpc = createElectronSideBirpc<RenderedFunctions, typeof this.functions>("llmRpc", "llmRpc", window, this.functions);

        this.sendCurrentLlmState = this.sendCurrentLlmState.bind(this);

        llmState.createChangeListener(this.sendCurrentLlmState);
        this.sendCurrentLlmState();
    }

    public sendCurrentLlmState() {
        this.rendererLlmRpc.updateState(llmState.state);
    }
}

export type ElectronFunctions = typeof ElectronLlmRpc.prototype.functions;

export function registerLlmRpc(window: BrowserWindow) {
    new ElectronLlmRpc(window);
}
