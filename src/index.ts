#!/usr/bin/env node
import { promises as fs } from 'fs';
import { resolve, isAbsolute } from 'path';
import sharp from 'sharp';
import fetch from 'node-fetch';

// MCP Types
interface ServerInfo {
  name: string;
  version: string;
}

interface ServerCapabilities {
  tools: Record<string, unknown>;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

interface McpRequest<T> {
  params: T;
}

interface ListToolsRequest {}

interface CallToolRequest {
  name: string;
  arguments: Record<string, unknown>;
}

interface McpResponse<T> {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

class McpError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'McpError';
  }
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY environment variable is required');
}

async function analyzeImage(imagePath: string, question?: string, model?: string): Promise<string> {
  // Validate absolute path
  if (!isAbsolute(imagePath)) {
    throw new McpError(
      'InvalidParams',
      'Image path must be absolute'
    );
  }

  try {
    const imageBuffer = await fs.readFile(imagePath);
    console.error('Successfully read image buffer of size:', imageBuffer.length);
    
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    console.error('Image metadata:', metadata);
    
    // Calculate dimensions to keep base64 size reasonable
    const MAX_DIMENSION = 400;
    const JPEG_QUALITY = 60;
    let resizedBuffer = imageBuffer;
    
    if (metadata.width && metadata.height) {
      const largerDimension = Math.max(metadata.width, metadata.height);
      if (largerDimension > MAX_DIMENSION) {
        const resizeOptions = metadata.width > metadata.height
          ? { width: MAX_DIMENSION }
          : { height: MAX_DIMENSION };
        
        resizedBuffer = await sharp(imageBuffer)
          .resize(resizeOptions)
          .jpeg({ quality: JPEG_QUALITY })
          .toBuffer();
      } else {
        resizedBuffer = await sharp(imageBuffer)
          .jpeg({ quality: JPEG_QUALITY })
          .toBuffer();
      }
    }

    const base64Image = resizedBuffer.toString('base64');
    
    // Analyze with OpenRouter
    const requestBody = {
      model: model || "anthropic/claude-3.5-sonnet",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: question || "What's in this image?"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ]
    };

    console.error('Sending request to OpenRouter...');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/bendichter/read_images',
        'X-Title': 'Image Analysis Tool'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.error('Response status:', response.status);
    
    const responseText = await response.text();
    console.error('Response text:', responseText);
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}\nDetails: ${responseText}`);
    }
    
    const analysis = JSON.parse(responseText);
    console.error('OpenRouter API response:', JSON.stringify(analysis, null, 2));
    return analysis.choices[0].message.content;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

class ImageAnalysisServer {
  private info: ServerInfo;
  private capabilities: ServerCapabilities;
  private handlers: Map<string, (request: any) => Promise<any>>;

  constructor() {
    this.info = {
      name: 'read-images',
      version: '0.1.0',
    };
    this.capabilities = {
      tools: {},
    };
    this.handlers = new Map();

    this.setupHandlers();
    
    process.on('SIGINT', () => {
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    // List Tools Handler
    this.handlers.set('list_tools', async (_request: McpRequest<ListToolsRequest>) => ({
      tools: [
        {
          name: 'analyze_image',
          description: 'Analyze an image using OpenRouter vision models (default: anthropic/claude-3.5-sonnet)',
          inputSchema: {
            type: 'object',
            properties: {
              image_path: {
                type: 'string',
                description: 'Path to the image file to analyze (must be absolute path)'
              },
              question: {
                type: 'string',
                description: 'Question to ask about the image'
              },
              model: {
                type: 'string',
                description: 'OpenRouter model to use (e.g., anthropic/claude-3-opus-20240229)'
              }
            },
            required: ['image_path']
          }
        }
      ]
    }));

    // Call Tool Handler
    this.handlers.set('call_tool', async (request: McpRequest<CallToolRequest>) => {
      if (request.params.name !== 'analyze_image') {
        throw new McpError(
          'MethodNotFound',
          `Unknown tool: ${request.params.name}`
        );
      }

      const args = request.params.arguments as {
        image_path: string;
        question?: string;
        model?: string;
      };

      try {
        const result = await analyzeImage(args.image_path, args.question, args.model);
        return {
          content: [
            {
              type: 'text',
              text: result
            }
          ]
        };
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        return {
          content: [
            {
              type: 'text',
              text: `Error analyzing image: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async handleRequest(method: string, params: any): Promise<any> {
    const handler = this.handlers.get(method);
    if (!handler) {
      throw new McpError('MethodNotFound', `Unknown method: ${method}`);
    }
    return handler({ params });
  }

  async run(): Promise<void> {
    process.stdin.setEncoding('utf8');
    
    let buffer = '';
    process.stdin.on('data', (chunk: string) => {
      buffer += chunk;
      
      while (true) {
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex === -1) break;
        
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        
        try {
          const request = JSON.parse(line);
          this.handleRequest(request.method, request.params)
            .then(result => {
              const response = {
                id: request.id,
                result
              };
              process.stdout.write(JSON.stringify(response) + '\n');
            })
            .catch(error => {
              const response = {
                id: request.id,
                error: {
                  code: error instanceof McpError ? error.code : 'InternalError',
                  message: error.message
                }
              };
              process.stdout.write(JSON.stringify(response) + '\n');
            });
        } catch (error) {
          console.error('Error processing request:', error);
        }
      }
    });

    console.error('Image Analysis MCP server running on stdio');
  }
}

const server = new ImageAnalysisServer();
server.run().catch(console.error);
