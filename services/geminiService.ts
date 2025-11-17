
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { DietaryFilter, GeminiResponse } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const recipeSchema = {
    type: Type.OBJECT,
    properties: {
        identifiedIngredients: {
            type: Type.ARRAY,
            description: "A list of all edible ingredients identified in the image.",
            items: { type: Type.STRING }
        },
        recipes: {
            type: Type.ARRAY,
            description: "A list of recipe objects based on the identified ingredients.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The name of the recipe." },
                    difficulty: { type: Type.STRING, description: "Difficulty rating: 'Easy', 'Medium', or 'Hard'." },
                    prepTime: { type: Type.STRING, description: "Estimated prep and cook time, e.g., '45 mins'." },
                    calories: { type: Type.STRING, description: "Estimated calories per serving, e.g., '550 kcal'." },
                    ingredients: {
                        type: Type.ARRAY,
                        description: "All ingredients required for the recipe.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "The name of the ingredient, e.g., 'Milk'." },
                                quantity: { type: Type.STRING, description: "The quantity, e.g., '1 cup'." }
                            },
                            required: ['name', 'quantity']
                        }
                    },
                    instructions: {
                        type: Type.ARRAY,
                        description: "Step-by-step cooking instructions.",
                        items: { type: Type.STRING }
                    }
                },
                required: ['name', 'difficulty', 'prepTime', 'calories', 'ingredients', 'instructions']
            }
        }
    },
    required: ['identifiedIngredients', 'recipes']
};

export const generateRecipesFromImage = async (
  base64ImageData: string,
  mimeType: string,
  dietaryFilters: DietaryFilter[]
): Promise<GeminiResponse> => {
    try {
        const dietaryPrompt = dietaryFilters.length > 0
            ? `Please ensure all recipes adhere to the following dietary restrictions: ${dietaryFilters.join(', ')}.`
            : '';

        const prompt = `
            You are a world-class culinary assistant. Analyze the provided image of a refrigerator's contents.

            First, identify all the visible, edible ingredients.

            Second, based on the identified ingredients, generate 5 creative recipes. For each recipe, provide all the requested details.
            
            ${dietaryPrompt}

            Return your entire response as a single, valid JSON object that follows the provided schema. Do not include any text, markdown formatting, or explanations outside of the JSON object.
        `;

        const imagePart = {
            inlineData: {
                data: base64ImageData,
                mimeType,
            },
        };
        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: recipeSchema,
            },
        });

        const jsonText = response.text.trim();
        const parsedData: GeminiResponse = JSON.parse(jsonText);
        return parsedData;

    } catch (error) {
        console.error("Error generating recipes:", error);
        throw new Error("Failed to analyze image and generate recipes. Please try a different image.");
    }
};

export const generateSpeech = async (text: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Read this aloud clearly: ${text}` }] }],
            config: {
                // Fix: Use Modality.AUDIO enum as per Gemini API guidelines.
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from API.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error generating speech:", error);
        throw new Error("Failed to generate audio for the step.");
    }
};
