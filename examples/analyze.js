// Example script demonstrating how to use the read_images MCP server
import { use_mcp_tool } from '@modelcontextprotocol/sdk';

// Basic usage with default model
const result1 = await use_mcp_tool({
  server_name: "read_images",
  tool_name: "analyze_image",
  arguments: {
    image_path: "./sample.jpg",
    question: "What do you see in this image?"
  }
});

console.log('Analysis with default model:');
console.log(result1);

// Using a specific model
const result2 = await use_mcp_tool({
  server_name: "read_images",
  tool_name: "analyze_image",
  arguments: {
    image_path: "./sample.jpg",
    question: "What colors are most prominent in this image?",
    model: "anthropic/claude-3-opus-20240229"
  }
});

console.log('\nAnalysis with Claude-3-opus:');
console.log(result2);
