import {createRendererSideBirpc} from "../utils/createRendererSideBirpc.ts";
import {llmState} from "../state/llmState.ts";
import type {ElectronFunctions} from "../../electron/rpc/llmRpc.ts";
import type {LlmState} from "../../electron/state/llmState.ts";


const renderedFunctions = {
    updateState(state: LlmState) {
        llmState.state = state;
    }
} as const;
export type RenderedFunctions = typeof renderedFunctions;

export const electronLlmRpc = createRendererSideBirpc<ElectronFunctions, RenderedFunctions>("llmRpc", "llmRpc", renderedFunctions);

electronLlmRpc.getState()
    .then((state) => {
        llmState.state = state;
    })
    .catch((error) => {
        console.error("Failed to get the initial state from the main process", error);
    });
