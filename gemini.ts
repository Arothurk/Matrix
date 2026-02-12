import { GoogleGenAI } from "@google/genai";

const getApiKey = (): string | undefined => {
  // Standardized Environment Variable
  const key = process.env.API_KEY;
  
  if (!key) {
    console.warn("Matrix Vision System Warning: API_KEY is missing. AI features will be disabled.");
    return undefined;
  }
  return key;
};

export const checkAIConnection = (): boolean => {
  return !!process.env.API_KEY;
};

export const decodeMatrixImage = async (base64Image: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    // Return a specific string that the UI can detect to show a friendly configuration prompt
    return "CONFIG_MISSING";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Clean base64 string if it contains metadata header
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: 'image/jpeg',
            },
          },
          {
            text: "You are an operator in the Matrix. I am sending you a raw data feed (a visual represented by green code characters). Decipher the visual pattern and tell me exactly what objects or scene is hidden in this code. Be brief and use a 'hacker' persona tone."
          },
        ],
      },
      config: {
        systemInstruction: "You are Tank, the operator from the Matrix. You analyze raw code streams.",
        temperature: 0.7,
      }
    });

    return response.text || "Connection interrupted. No data received.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Error decoding stream. The signal is too weak.";
  }
};