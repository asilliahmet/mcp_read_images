#!/usr/bin/env node
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import sharp from 'sharp';
import fetch from 'node-fetch';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY environment variable is required');
}

async function analyzeImage(imagePath: string, question?: string) {
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
      model: "anthropic/claude-3.5-sonnet",
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
    console.error('Request body:', JSON.stringify(requestBody, null, 2));
    
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

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node index.js <image_path> [question]');
  process.exit(1);
}

const imagePath = args[0];
const question = args[1];

analyzeImage(imagePath, question)
  .then(result => console.log(result))
  .catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
