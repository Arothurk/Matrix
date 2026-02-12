import { GoogleGenAI } from "@google/genai";

const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing via process.env.API_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

export const decodeMatrixImage = async (base64Image: string): Promise<string> => {
  try {
    const ai = getGeminiClient();
    
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