
export interface Ingredient {
  name: string;
  quantity: string;
}

export interface Recipe {
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  prepTime: string;
  calories: string;
  ingredients: Ingredient[];
  instructions: string[];
}

export interface GeminiResponse {
  identifiedIngredients: string[];
  recipes: Recipe[];
}

export type View = 'upload' | 'recipes' | 'cooking' | 'shopping';

export type DietaryFilter = 'vegetarian' | 'keto' | 'gluten-free' | 'vegan';
