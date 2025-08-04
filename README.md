# MCP Read Images

An MCP server for analyzing images using OpenAI vision models. This server provides a simple interface to analyze images using OpenAI's powerful vision models including the latest GPT-4.1 series, GPT-4o, and GPT-4-turbo through the OpenAI API.

## Installation

```bash
git clone https://github.com/asilliahmet/mcp_read_images.git
cd mcp_read_images
npm install
npm run build
echo "Your node script is at: $(pwd)/build/index.js" 
```

## Configuration

The server requires an OpenAI API key. You can get one from [OpenAI](https://platform.openai.com/api-keys).

Add the server to your MCP settings file (usually located at `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` for VSCode):

```json
{
  "mcpServers": {
    "read_images": {
      "command": "node",
      "args": [
        "/YOUR/PATH/FROM/ECHO/COMMAND/build/index.js"
      ],
      "env": {
        "OPENAI_API_KEY": "your-openai-api-key-here",
        "OPENAI_MODEL": "gpt-4.1"  // optional, defaults to gpt-4.1
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Environment Variables

The server requires the following environment variables:

- **`OPENAI_API_KEY`** (required): Your OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)
- **`OPENAI_MODEL`** (optional): The OpenAI model to use. Defaults to `gpt-4.1` if not specified.

### Available Models

| Model | Description | Best For |
|-------|-------------|----------|
| `gpt-4.1` (default) | Latest flagship model (April 2025) - 1M context | Most advanced visual analysis, design screenshots |
| `gpt-4.1-mini` | Faster, cost-effective version of 4.1 | Quick analysis with latest capabilities |
| `gpt-4.1-nano` | Smallest version of 4.1 | Lightweight image understanding |
| `gpt-4o` | Previous flagship model | Complex visual analysis, design work |
| `gpt-4o-mini` | Faster, cost-effective option | Simple image descriptions, quick analysis |
| `gpt-4-turbo` | Previous generation | General purpose image analysis |
| `gpt-4` | Original GPT-4 | Basic image understanding |
| `gpt-4-vision-preview` | Deprecated but supported | Legacy applications |

## Usage

The server provides a single tool `analyze_image` that can be used to analyze images using OpenAI vision models (default: gpt-4.1):

```typescript
// Basic usage with default model
use_mcp_tool({
  server_name: "read_images",
  tool_name: "analyze_image",
  arguments: {
    image_path: "/path/to/image.jpg",
    question: "What do you see in this image?"  // optional
  }
});

// Using a specific model for this call
use_mcp_tool({
  server_name: "read_images",
  tool_name: "analyze_image",
  arguments: {
    image_path: "/path/to/image.jpg",
    question: "What do you see in this image?",
    model: "gpt-4.1-mini"  // overrides default and settings
  }
});
```

### Model Selection

The model is selected in the following order of precedence:
1. Model specified in the tool call (`model` argument)
2. Model specified in MCP settings (`OPENAI_MODEL` environment variable)
3. Default model (gpt-4.1)

### Supported Models

The following OpenAI vision models are supported:
- `gpt-4.1` (default) - Latest flagship model with 1M context window
- `gpt-4.1-mini` - Faster, cost-effective version of 4.1
- `gpt-4.1-nano` - Smallest version of 4.1
- `gpt-4o` - Previous flagship model
- `gpt-4o-mini` - Faster and more cost-effective
- `gpt-4-turbo` - Good balance of quality and speed
- `gpt-4` - Standard GPT-4 with vision capabilities
- `gpt-4-vision-preview` - Deprecated but still supported

## Features

- Automatic image resizing and optimization (up to 1024px for high quality)
- Configurable OpenAI model selection
- Support for custom questions about images
- High-detail analysis mode for design screenshots and UI elements
- Enhanced JPEG quality (85%) for better visual analysis
- Detailed error messages
- Automatic JPEG conversion and quality optimization

## Error Handling

The server handles various error cases:
- Invalid image paths (must be absolute paths)
- Missing API keys (OPENAI_API_KEY environment variable required)
- Network errors
- Invalid model selections (warns if model may not support vision)
- Image processing errors

Each error will return a descriptive message to help diagnose the issue. The server validates model names against a list of known vision-capable models and will issue warnings for unsupported models while still attempting to use them.

## Development

To build from source:

```bash
git clone https://github.com/asilliahmet/mcp_read_images.git
cd mcp_read_images
npm install
npm run build
echo "Your node script is at: $(pwd)/build/index.js" 
```

And then change your mcp.json file like this:
```json
{
  "mcpServers": {
     "read-images": {
      "command": "node",
      "args": [
        "/YOUR/PATH/FROM/ECHO/COMMAND/build/index.js"
      ],
      "env": {
        "OPENAI_API_KEY": "your-openai-api-key-here",
        "OPENAI_MODEL": "gpt-4.1"
      }
    }
  }
}
```

## License

MIT License. See [LICENSE](LICENSE) for details.
