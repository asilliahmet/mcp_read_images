# MCP Read Images

An MCP server for analyzing images using OpenRouter vision models. This server provides a simple interface to analyze images using various vision models like Claude-3.5-sonnet and Claude-3-opus through the OpenRouter API.

## Installation

```bash
npm install @catalystneuro/mcp_read_images
```

## Configuration

The server requires an OpenRouter API key. You can get one from [OpenRouter](https://openrouter.ai/keys).

Add the server to your MCP settings file (usually located at `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` for VSCode):

```json
{
  "mcpServers": {
    "read_images": {
      "command": "read_images",
      "env": {
        "OPENROUTER_API_KEY": "your-api-key-here",
        "OPENROUTER_MODEL": "anthropic/claude-3.5-sonnet"  // optional, defaults to claude-3.5-sonnet
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Usage

The server provides a single tool `analyze_image` that can be used to analyze images:

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
    model: "anthropic/claude-3-opus-20240229"  // overrides default and settings
  }
});
```

### Model Selection

The model is selected in the following order of precedence:
1. Model specified in the tool call (`model` argument)
2. Model specified in MCP settings (`OPENROUTER_MODEL` environment variable)
3. Default model (anthropic/claude-3.5-sonnet)

### Supported Models

The following OpenRouter models have been tested:
- anthropic/claude-3.5-sonnet
- anthropic/claude-3-opus-20240229

## Features

- Automatic image resizing and optimization
- Configurable model selection
- Support for custom questions about images
- Detailed error messages
- Automatic JPEG conversion and quality optimization

## Error Handling

The server handles various error cases:
- Invalid image paths
- Missing API keys
- Network errors
- Invalid model selections
- Image processing errors

Each error will return a descriptive message to help diagnose the issue.

## Development

To build from source:

```bash
git clone https://github.com/catalystneuro/mcp_read_images.git
cd mcp_read_images
npm install
npm run build
```

## License

MIT License. See [LICENSE](LICENSE) for details.
