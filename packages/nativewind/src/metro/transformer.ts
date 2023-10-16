import worker, {
  JsTransformerConfig,
  JsTransformOptions,
  TransformResponse,
} from "metro-transform-worker";
import path from "path";

import { transform as cssInteropTransform } from "react-native-css-interop/metro/transformer";
import { getOutput } from "./common";

interface NativeWindJsTransformerConfig extends JsTransformerConfig {
  transformerPath?: string;
  nativewind: {
    input: string;
    output: string;
    fastRefreshPort: string;
  };
}

export async function transform(
  config: NativeWindJsTransformerConfig,
  projectRoot: string,
  filename: string,
  data: Buffer,
  options: JsTransformOptions,
): Promise<TransformResponse> {
  // If we are importing the .css file, make it an alias for the output generated by Tailwind CLI
  if (path.resolve(process.cwd(), filename) === config.nativewind.input) {
    if (options.platform !== "web" && options.dev) {
      // Ignore the file in native dev mode, as it will be handled by the WebSocket server
      return worker.transform(
        config,
        projectRoot,
        filename,
        Buffer.from(
          `const url = require("react-native/Libraries/Core/Devtools/getDevServer")().url.replace(/(https?:\\/\\/.*)(:\\d*\\/)(.*)/, "$1$3")
new globalThis.WebSocket(\`\${url}:${config.nativewind.fastRefreshPort}\`).addEventListener("message", (event) => {
  require("react-native-css-interop").StyleSheet.register(JSON.parse(event.data))
});`,
          "utf8",
        ),
        options,
      );
    } else {
      // Redirect this file to the output generated by Tailwind CLI
      return worker.transform(
        config,
        projectRoot,
        filename,
        Buffer.from(
          `import '${getOutput(config.nativewind.output, options)}'`,
          "utf8",
        ),
        options,
      );
    }
  }

  // Otherwise use the cssInteropTransform. It will handle JS files and composing transformers
  return cssInteropTransform(config, projectRoot, filename, data, options);
}
