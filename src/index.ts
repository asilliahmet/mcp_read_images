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

// OpenAI API key will be checked when actually used

const checkOpenaiKey = ()=>{
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    process.emit("SIGINT")
    console.error("OPENAI_API_KEY environment variable is required")
    throw new McpError(
      'MissingApiKey',
      'OPENAI_API_KEY environment variable is required'
    );
    
  }
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
    const MAX_DIMENSION = 1024; // Increased for better quality with OpenAI
    const JPEG_QUALITY = 85; // Higher quality for better detection
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
    
    // Check for API key when actually needed
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      throw new McpError(
        'MissingApiKey',
        'OPENAI_API_KEY environment variable is required'
      );
    }

    // Get model from environment or use default
    const selectedModel = model || process.env.OPENAI_MODEL || "gpt-4.1";
    
    // Validate model is a vision-capable model
    const validModels = [
      'gpt-4.1',          // Latest flagship model (April 2025) - 1M context
      'gpt-4.1-mini',     // Faster, cost-effective version of 4.1
      'gpt-4.1-nano',     // Smallest version of 4.1
      'gpt-4o',           // Previous flagship model
      'gpt-4o-mini',      // Faster, cost-effective
      'gpt-4-turbo',      // Previous generation
      'gpt-4',            // Original GPT-4
      'gpt-4-vision-preview' // Deprecated but still supported
    ];
    if (!validModels.includes(selectedModel)) {
      console.error(`Warning: Model '${selectedModel}' may not support vision. Supported models: ${validModels.join(', ')}`);
    }
    
    // Analyze with OpenAI
    const requestBody = {
      model: selectedModel,
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
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high" // Use high detail for better design screenshot analysis
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    };

    console.error('Sending request to OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        "X-HTTP-Referer": "https://github.com/asilliahmet/mcp_read_images"
      },
      body: JSON.stringify(requestBody)
    });
    
    console.error('Response status:', response.status);
    
    const responseText = await response.text();
    console.error('Response text:', responseText);
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}\nDetails: ${responseText}`);
    }
    
    const analysis = JSON.parse(responseText);
    console.error('OpenAI API response:', JSON.stringify(analysis, null, 2));
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
    // Initialize Handler - Required for MCP protocol
    this.handlers.set('initialize', async (request: McpRequest<any>) => {
      const { protocolVersion, capabilities, clientInfo } = request.params;
      
      console.error('Initialize request received:', { protocolVersion, capabilities, clientInfo });
      
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: undefined,
          prompts: undefined,
          logging: {}
        },
        serverInfo: this.info
      };
    });

    // Initialized notification handler - Called after successful initialization
    this.handlers.set('notifications/initialized', async (_request: McpRequest<any>) => {
      console.error('Initialized notification received');
      // No response needed for notifications
      return;
    });

    // List Tools Handler
    this.handlers.set('tools/list', async (_request: McpRequest<ListToolsRequest>) => ({
      tools: [
        {
          name: 'analyze_image',
          description: 'Analyze an image using OpenAI vision models (default: gpt-4.1)',
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
                description: 'OpenAI model to use (e.g., gpt-4.1, gpt-4.1-mini, gpt-4o, gpt-4o-mini)'
              }
            },
            required: ['image_path']
          }
        }
      ]
    }));

    // Call Tool Handler
    this.handlers.set('tools/call', async (request: McpRequest<CallToolRequest>) => {
      checkOpenaiKey();

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

    // Ping handler for connection health checks
    this.handlers.set('ping', async (_request: McpRequest<any>) => ({}));
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
        
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        
        if (!line) continue; // Skip empty lines
        
        try {
          const request = JSON.parse(line);
          console.error('Received request:', request.method, request.id);
          
          // Handle the request
          this.handleRequest(request.method, request.params || {})
            .then(result => {
              // Check if this is a notification (no id means no response expected)
              if (request.id !== undefined && request.id !== null) {
                const response = {
                  jsonrpc: '2.0',
                  id: request.id,
                  result
                };
                console.error('Sending response:', response);
                process.stdout.write(JSON.stringify(response) + '\n');
              } else {
                // This was a notification, no response needed
                console.error('Processed notification:', request.method);
              }
            })
            .catch(error => {
              // Only send error response if this wasn't a notification
              if (request.id !== undefined && request.id !== null) {
                const response = {
                  jsonrpc: '2.0',
                  id: request.id,
                  error: {
                    code: this.getErrorCode(error),
                    message: error.message,
                    data: error instanceof McpError ? undefined : error.stack
                  }
                };
                console.error('Sending error response:', response);
                process.stdout.write(JSON.stringify(response) + '\n');
              } else {
                console.error('Error in notification:', error.message);
              }
            });
        } catch (error) {
          console.error('Error parsing JSON-RPC message:', error, 'Line:', line);
          // Send a parse error response if we can
          const response = {
            jsonrpc: '2.0',
            id: null,
            error: {
              code: 'ParseError',
              message: 'Invalid JSON-RPC message'
            }
          };
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      }
    });

    console.error('Image Analysis MCP server running on stdio');
  }

  private getErrorCode(error: any): string {
    if (error instanceof McpError) {
      return error.code;
    }
    
    // Map common error types to MCP error codes
    if (error.message?.includes('Unknown method')) {
      return 'MethodNotFound';
    }
    if (error.message?.includes('Invalid params')) {
      return 'InvalidParams';
    }
    
    return 'InternalError';
  }
}

const server = new ImageAnalysisServer();
server.run().catch(console.error);