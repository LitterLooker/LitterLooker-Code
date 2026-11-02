import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { LitterStats } from "../types";

/**
 * Utility to extract MIME type and data from a data URL or raw base64.
 */
function parseBase64Image(base64Image: string): { mimeType: string; data: string } {
  const matches = base64Image.match(/^data:([^;]+);base64,(.+)$/);
  if (matches) {
    return { mimeType: matches[1], data: matches[2] };
  }
  // Default to jpeg if no header found
  return { mimeType: "image/jpeg", data: base64Image };
}

/**
 * Utility to retry API calls with exponential backoff when hitting rate limits (429).
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorString = error?.message || JSON.stringify(error) || "";
      const isRateLimit = errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED');
      
      if (isRateLimit && i < maxRetries - 1) {
        const delay = Math.pow(2, i + 1) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const ERROR_MESSAGE = "AI Services currently unavailable. Please try again later.";

const GLOBAL_API_KEY = (typeof process !== 'undefined' ? (process.env.GEMINI_API_KEY || process.env.API_KEY) : '') || '';

if (!GLOBAL_API_KEY) {
  console.warn("Gemini API Key is missing. AI features will be disabled. Please set GEMINI_API_KEY in your environment variables.");
}

export async function searchNearbyWasteFacilities(lat: number, lng: number) {
  const apiKey = GLOBAL_API_KEY;
  if (!apiKey) {
    console.error("Gemini API Key is missing. Please set GEMINI_API_KEY in environment variables.");
    return null;
  }
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the 3 CLOSEST recycling centers or waste disposal sites to latitude ${lat} and longitude ${lng}. 
      
      CRITICAL FORMATTING INSTRUCTIONS:
      For each of the 3 facilities, you must provide the name followed by coordinates in this exact syntax: "[COORD: latitude, longitude]".
      
      Example Response:
      1. City Recycling Hub [COORD: 34.0522, -118.2437] - A full service center.
      2. Eco-Bin Dropoff [COORD: 34.0530, -118.2440] - Best for plastics.
      3. Green Waste Center [COORD: 34.0510, -118.2420] - Open 24/7.
 
      Return ONLY the list of 3 items with their coordinates and a very brief 1-sentence description each.`,
    }));

    const text = response.text || "No specific facilities found nearby.";
    
    return {
      text,
      sources: [] // Intentionally empty to get rid of external links
    };
  } catch (error) {
    console.error("Gemini API Error (searchNearbyWasteFacilities):", error);
    return {
      text: ERROR_MESSAGE,
      sources: []
    };
  }
}

export async function findLitterHotspots(lat: number, lng: number, count: number, existingPins: any[]) {
  const apiKey = GLOBAL_API_KEY;
  if (!apiKey) {
    console.error("Gemini API Key is missing. Please set GEMINI_API_KEY in environment variables.");
    throw new Error("Gemini API Key is missing");
  }
  const ai = new GoogleGenAI({ apiKey });
  try {
    const pinContext = existingPins.length > 0 
      ? `Existing user-reported litter pins in this area: ${JSON.stringify(existingPins.map(p => ({ desc: p.description, lat: p.lat, lng: p.lng })))}`
      : "No user-reported pins currently exist in this specific database view.";

    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an environmental consultant for LitterLooker. Find ${count} major litter/pollution hotspots near latitude ${lat}, longitude ${lng}.
      Use real-world search data to identify areas known for littering, illegal dumping, or environmental neglect in this specific region (e.g. specific parks, industrial zones, or waterfronts).
      
      ${pinContext}

      STRICT REQUIREMENT: Return ONLY a JSON array of objects.
      Each object must have: 
      - "name": (string) Short name of the location
      - "lat": (number) Latitude
      - "lng": (number) Longitude
      - "reason": (string) Brief reason why this is a hotspot
      - "radius": (integer) Suggested radius in meters (100-500) based on area size
      - "multiplier": (integer) Suggested XP multiplier (2-10) based on severity`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
              reason: { type: Type.STRING },
              radius: { type: Type.INTEGER },
              multiplier: { type: Type.INTEGER }
            },
            required: ["name", "lat", "lng", "reason", "radius", "multiplier"]
          }
        }
      },
    }));

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Hotspot search error:", error);
    throw error;
  }
}

export async function analyzeLitterImage(base64Images: string[]): Promise<{ intensity: number; isInvalid: boolean; error?: boolean }> {
  const apiKey = GLOBAL_API_KEY;
  if (!apiKey) {
    console.error("Gemini API Key is missing. Please set GEMINI_API_KEY in environment variables.");
    return { intensity: 50, isInvalid: false, error: true };
  }
  const ai = new GoogleGenAI({ apiKey });
  try {
    console.log("Analyzing litter image...");
    const imageParts = base64Images.map(img => {
      const { mimeType, data } = parseBase64Image(img);
      return {
        inlineData: {
          mimeType: mimeType,
          data: data
        }
      };
    });

    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          ...imageParts,
          {
            text: "Analyze these images. First, determine if they actually contain litter or trash. If they do NOT contain any litter or trash (e.g., they are a person, a room, a sunset, or a mistake), set 'isInvalid' to true. If they DO contain litter, determine the overall intensity of the litter on a scale of 0-100%. Return a JSON object."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intensity: { type: Type.NUMBER },
            isInvalid: { type: Type.BOOLEAN }
          },
          required: ["intensity", "isInvalid"]
        }
      }
    }));

    console.log("Gemini response:", response.text);
    const result = JSON.parse(response.text || '{}');
    return {
      intensity: result.intensity || 50,
      isInvalid: !!result.isInvalid
    };
  } catch (error) {
    console.error("Gemini Image Analysis Error (analyzeLitterImage):", error);
    return { intensity: 50, isInvalid: false, error: true };
  }
}

export async function analyzeCleanupStatus(base64Images: string[], description: string): Promise<{ percentage: number; isCleaned: boolean; isInvalid: boolean } | 'ERROR'> {
  const apiKey = GLOBAL_API_KEY;
  if (!apiKey) {
    console.error("Gemini API Key is missing. Please set GEMINI_API_KEY in environment variables.");
    return 'ERROR';
  }
  const ai = new GoogleGenAI({ apiKey });
  try {
    const imageParts = base64Images.map(img => {
      const { mimeType, data } = parseBase64Image(img);
      return {
        inlineData: {
          mimeType: mimeType,
          data: data
        }
      };
    });

    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          ...imageParts,
          {
            text: `The user provided these images as proof of cleanup with description: "${description}". First, determine if these are relevant photos of an environment/cleanup site. If they are completely irrelevant (e.g. a face, a pet, or unrelated indoor scene), set 'isInvalid' to true. Otherwise, determine how much cleaner the area is compared to a typical 'dirty' state (0-100%). If it is completely clean, set 'isCleaned' to true and 'percentage' to 100. Return a JSON object.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            percentage: { type: Type.NUMBER },
            isCleaned: { type: Type.BOOLEAN },
            isInvalid: { type: Type.BOOLEAN }
          },
          required: ["percentage", "isCleaned", "isInvalid"]
        }
      }
    }));

    const result = JSON.parse(response.text || '{}');
    return {
      percentage: result.percentage || 0,
      isCleaned: !!result.isCleaned,
      isInvalid: !!result.isInvalid
    };
  } catch (error) {
    console.error("Gemini Cleanup Analysis Error (analyzeCleanupStatus):", error);
    return 'ERROR';
  }
}

export async function analyzeUpdatedUrgency(base64Image: string): Promise<'extreme' | 'moderate' | 'light' | 'cleaned' | 'invalid' | 'error'> {
  const apiKey = GLOBAL_API_KEY;
  if (!apiKey) {
    console.error("Gemini API Key is missing. Please set GEMINI_API_KEY in environment variables.");
    return 'error';
  }
  const ai = new GoogleGenAI({ apiKey });
  try {
    const { mimeType, data } = parseBase64Image(base64Image);

    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: data
            }
          },
          {
            text: "Evaluate the current state of litter in this progress update photo. If the area is now completely clean, return 'CLEANED'. If there is still litter, return the current urgency level ('extreme', 'moderate', or 'light'). If the photo is irrelevant, return 'INVALID'. Only return one word."
          }
        ]
      }
    }));

    const text = response.text?.toLowerCase().trim() || "";
    if (text.includes('invalid')) return 'invalid';
    if (text.includes('cleaned')) return 'cleaned';
    if (text.includes('extreme')) return 'extreme';
    if (text.includes('moderate')) return 'moderate';
    if (text.includes('light')) return 'light';
    return 'moderate';
  } catch (error) {
    console.error("Gemini Updated Urgency Analysis Error (analyzeUpdatedUrgency):", error);
    return 'error';
  }
}

export async function checkSubmissionIntegrity(base64Image: string, description: string, actionType: string): Promise<{ isLegit: boolean; reason?: string; error?: boolean }> {
  const apiKey = GLOBAL_API_KEY;
  if (!apiKey) {
    console.error("Gemini API Key is missing. Please set GEMINI_API_KEY in environment variables.");
    return { isLegit: true, error: true };
  }
  const ai = new GoogleGenAI({ apiKey });
  try {
    const { mimeType, data } = parseBase64Image(base64Image);
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: data
            }
          },
          {
            text: `Action: ${actionType}. User Description: "${description}". 
            Context: This user is earning points (Scrap) for this action. 
            Is this user attempting to cheat, spam, or trick the system? 
            Cheat includes submissions of non-trash items or low-effort farming.
            Determine if this is point-farming/trickery (CHEAT) or an honest contribution (LEGIT).`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            decision: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ["decision", "reason"]
        }
      }
    }));

    const result = JSON.parse(response.text || "{}");
    const isCheat = result.decision === 'CHEAT';
    
    return {
      isLegit: !isCheat,
      reason: isCheat ? result.reason : undefined
    };
  } catch (error) {
    console.error("Integrity Check Error (checkSubmissionIntegrity):", error);
    return { isLegit: true, error: true }; 
  }
}

export async function checkPhotoReused(base64Original: string, base64New: string): Promise<boolean> {
  const apiKey = GLOBAL_API_KEY;
  if (!apiKey) {
    console.error("Gemini API Key is missing. Please set GEMINI_API_KEY in environment variables.");
    return false;
  }
  const ai = new GoogleGenAI({ apiKey });
  try {
    const orig = parseBase64Image(base64Original);
    const upd = parseBase64Image(base64New);

    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: orig.mimeType,
              data: orig.data
            }
          },
          {
            inlineData: {
              mimeType: upd.mimeType,
              data: upd.data
            }
          },
          {
            text: "Are these two images visually the same photo or the same scene with no meaningful changes? If the user is trying to pass off the same photo as a new update (duplicate), return 'REUSED'. Otherwise return 'NEW'. Return only one word."
          }
        ]
      }
    }));

    const result = response.text?.toUpperCase() || "NEW";
    return result.includes("REUSED");
  } catch (error) {
    console.error("Photo Reuse Check Error (checkPhotoReused):", error);
    return false;
  }
}

export async function estimateLitterStats(base64Images: string[]): Promise<LitterStats | null> {
  const apiKey = GLOBAL_API_KEY;
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey });
  try {
    const imageParts = base64Images.map(img => {
      const { mimeType, data } = parseBase64Image(img);
      return { inlineData: { mimeType, data } };
    });

    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          ...imageParts,
          {
            text: "Analyze these images of litter/trash. Estimate the following statistics: 1. Total weight of trash in kilograms (kg). 2. Total area covered by trash in square meters (m²). 3. Approximate number of individual pieces of litter. Return a JSON object."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            weightKg: { type: Type.NUMBER },
            areaSqM: { type: Type.NUMBER },
            piecesCount: { type: Type.NUMBER }
          },
          required: ["weightKg", "areaSqM", "piecesCount"]
        }
      }
    }));

    const result = JSON.parse(response.text || '{}');
    return {
      weightKg: result.weightKg || 0,
      areaSqM: result.areaSqM || 0,
      piecesCount: result.piecesCount || 0
    };
  } catch (error) {
    console.error("Gemini Stats Estimation Error:", error);
    return null;
  }
}
