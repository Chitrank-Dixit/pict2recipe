
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Recipe, Ingredient, View, DietaryFilter, GeminiResponse } from './types';
import { generateRecipesFromImage, generateSpeech } from './services/geminiService';
import { decode, decodeAudioData } from './utils/audioUtils';

// --- HELPER FUNCTIONS ---
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

// --- ICONS (Defined outside component to prevent re-creation) ---
const FridgeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10c.55 0 1 .45 1 1v18c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1V3c0-.55.45-1 1-1zm2 4H8v4h1V6zm0 5H8v5h1v-5zM17 20H7v-8h10v8zM7 10V3h10v7H7z"/></svg>
);
const Spinner: React.FC = () => (
  <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);
const BackIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
);
const SpeakerIcon: React.FC<{ className?: string; isSpeaking: boolean }> = ({ className, isSpeaking }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    {isSpeaking ? (
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l-2.25 2.25M15.75 9.75 13.5 12m0 0 2.25 2.25M13.5 12l-2.25 2.25M6 18.75a8.25 8.25 0 1 1 14.228-5.25A1.5 1.5 0 0 0 18 12.75H6a1.5 1.5 0 0 0-1.228 2.25" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
    )}
  </svg>
);

// --- UI COMPONENTS (Defined outside main App component) ---

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  isLoading: boolean;
}
const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageUpload(e.dataTransfer.files[0]);
    }
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Smart Fridge Assistant</h2>
      <p className="text-gray-600 mb-8 max-w-md">Snap a photo of your fridge's contents, and I'll suggest delicious recipes you can make right now.</p>
      <div
        className={`relative w-full max-w-lg p-10 border-2 border-dashed rounded-xl transition-all duration-300 ${isDragging ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300 bg-white hover:border-indigo-500'}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleChange} className="hidden" />
        <div className="flex flex-col items-center justify-center space-y-4">
            <FridgeIcon className="h-16 w-16 text-gray-400" />
            <p className="text-gray-500">
              <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-400">PNG, JPG, or WEBP</p>
        </div>
      </div>
    </div>
  );
};

interface CookingModeViewProps {
  recipe: Recipe;
  onBack: () => void;
  onAddToShoppingList: (items: Ingredient[]) => void;
  identifiedIngredients: string[];
}
const CookingModeView: React.FC<CookingModeViewProps> = ({ recipe, onBack, onAddToShoppingList, identifiedIngredients }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [audioError, setAudioError] = useState<string | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    useEffect(() => {
        // Initialize AudioContext on user interaction (handled by button click)
        return () => {
            audioSourceRef.current?.stop();
            audioContextRef.current?.close();
        };
    }, []);

    const missingIngredients = useMemo(() => {
        const identifiedSet = new Set(identifiedIngredients.map(i => i.toLowerCase()));
        return recipe.ingredients.filter(ing => 
            !identifiedSet.has(ing.name.toLowerCase()) && 
            !identifiedIngredients.some(idIng => ing.name.toLowerCase().includes(idIng.toLowerCase()))
        );
    }, [recipe, identifiedIngredients]);

    const handleReadAloud = async () => {
        if (isSpeaking) {
            audioSourceRef.current?.stop();
            setIsSpeaking(false);
            return;
        }

        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        setIsSpeaking(true);
        setAudioError(null);
        try {
            const audioData = await generateSpeech(recipe.instructions[currentStep]);
            const decodedData = decode(audioData);
            const audioBuffer = await decodeAudioData(decodedData, audioContextRef.current, 24000, 1);
            
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => setIsSpeaking(false);
            source.start(0);
            audioSourceRef.current = source;
        } catch (error) {
            console.error(error);
            setAudioError("Couldn't play audio. Please try again.");
            setIsSpeaking(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-4 md:p-8 bg-white rounded-2xl shadow-lg h-full flex flex-col">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 mr-4"><BackIcon className="h-6 w-6" /></button>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex-grow">{recipe.name}</h2>
            </div>

            {missingIngredients.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <h4 className="font-semibold text-yellow-800">Missing Ingredients</h4>
                    <p className="text-sm text-yellow-700 mb-3">You might need these items:</p>
                    <ul className="list-disc list-inside text-sm text-yellow-700">
                        {missingIngredients.map(ing => <li key={ing.name}>{ing.quantity} {ing.name}</li>)}
                    </ul>
                    <button 
                        onClick={() => onAddToShoppingList(missingIngredients)}
                        className="mt-4 px-4 py-2 bg-yellow-400 text-yellow-900 font-semibold rounded-lg hover:bg-yellow-500 text-sm"
                    >
                        Add All to Shopping List
                    </button>
                </div>
            )}
            
            <div className="flex-grow flex flex-col justify-center items-center text-center px-4">
                <p className="text-lg text-gray-500 mb-2">Step {currentStep + 1} of {recipe.instructions.length}</p>
                <p className="text-3xl md:text-5xl font-medium text-gray-800 leading-snug">
                    {recipe.instructions[currentStep]}
                </p>
                {audioError && <p className="text-red-500 mt-4">{audioError}</p>}
            </div>

            <div className="flex items-center justify-between mt-8">
                <button 
                    onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
                    disabled={currentStep === 0}
                    className="px-6 py-3 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Previous
                </button>
                <button
                    onClick={handleReadAloud}
                    className="p-4 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300"
                    disabled={isSpeaking && !audioSourceRef.current}
                >
                    <SpeakerIcon className="h-8 w-8" isSpeaking={isSpeaking}/>
                </button>
                <button 
                    onClick={() => setCurrentStep(s => Math.min(recipe.instructions.length - 1, s + 1))}
                    disabled={currentStep === recipe.instructions.length - 1}
                    className="px-6 py-3 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Next
                </button>
            </div>
        </div>
    );
};


// --- MAIN APP COMPONENT ---

export default function App() {
  const [view, setView] = useState<View>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [identifiedIngredients, setIdentifiedIngredients] = useState<string[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [activeFilters, setActiveFilters] = useState<Set<DietaryFilter>>(new Set());
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [shoppingList, setShoppingList] = useState<Map<string, Ingredient>>(new Map());

  const handleImageUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setImagePreview(URL.createObjectURL(file));

    try {
        const base64Image = await fileToBase64(file);
        const result: GeminiResponse = await generateRecipesFromImage(base64Image, file.type, Array.from(activeFilters));
        
        setIdentifiedIngredients(result.identifiedIngredients);
        setAllRecipes(result.recipes);
        setView('recipes');

    } catch (e: any) {
        setError(e.message || "An unknown error occurred.");
        setView('upload'); // Stay on upload page on error
    } finally {
        setIsLoading(false);
    }
  }, [activeFilters]);

  const handleFilterChange = (filter: DietaryFilter) => {
    setActiveFilters(prev => {
        const newSet = new Set(prev);
        if (newSet.has(filter)) {
            newSet.delete(filter);
        } else {
            newSet.add(filter);
        }
        return newSet;
    });
  };

  const handleSelectRecipe = (recipe: Recipe) => {
      setSelectedRecipe(recipe);
      setView('cooking');
  }

  const handleAddToShoppingList = useCallback((items: Ingredient[]) => {
      setShoppingList(prev => {
          const newList = new Map(prev);
          items.forEach(item => {
              if (!newList.has(item.name.toLowerCase())) {
                  newList.set(item.name.toLowerCase(), item);
              }
          });
          return newList;
      });
      alert(`${items.length} item(s) added to your shopping list!`);
  }, []);

  const clearState = () => {
    setView('upload');
    setIsLoading(false);
    setError(null);
    setImagePreview(null);
    setIdentifiedIngredients([]);
    setAllRecipes([]);
    setSelectedRecipe(null);
  }

  const dietaryFilters: { id: DietaryFilter, label: string }[] = [
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'keto', label: 'Keto' },
      { id: 'gluten-free', label: 'Gluten-Free' },
      { id: 'vegan', label: 'Vegan' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center z-50">
          <Spinner />
          <p className="text-white mt-4 text-lg">Analyzing your fridge...</p>
        </div>
      )}

      <header className="w-full p-4 bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xl font-bold text-gray-800">
                  <FridgeIcon className="h-6 w-6 text-indigo-600"/>
                  <span>Culinary Assistant</span>
              </div>
              {view !== 'upload' && (
                <button onClick={clearState} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Start Over</button>
              )}
          </div>
      </header>

      <main className="flex-grow flex items-center justify-center">
        {view === 'upload' && <ImageUploader onImageUpload={handleImageUpload} isLoading={isLoading} />}
        {error && view === 'upload' && <div className="mt-4 text-center text-red-600 bg-red-100 p-3 rounded-lg max-w-md">{error}</div>}

        {view === 'recipes' && (
            <div className="w-full max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
                <aside className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-2xl shadow-sm sticky top-24">
                        <h3 className="text-lg font-semibold mb-4">Dietary Filters</h3>
                        <div className="space-y-3">
                            {dietaryFilters.map(filter => (
                                <label key={filter.id} className="flex items-center space-x-3 cursor-pointer">
                                    <input type="checkbox"
                                        checked={activeFilters.has(filter.id)}
                                        onChange={() => handleFilterChange(filter.id)}
                                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-gray-700">{filter.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </aside>
                <div className="lg:col-span-3">
                     <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">Recipe Suggestions</h2>
                        <div className="space-x-2">
                             <button onClick={() => setView('recipes')} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm">Recipes</button>
                             <button onClick={() => setView('shopping')} className="relative px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
                                 Shopping List
                                 {shoppingList.size > 0 && <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{shoppingList.size}</span>}
                            </button>
                         </div>
                     </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {allRecipes.map((recipe, index) => (
                            <div key={index} onClick={() => handleSelectRecipe(recipe)} className="bg-white rounded-2xl shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
                                <img src={`https://picsum.photos/seed/${recipe.name.replace(/\s/g, '')}/400/250`} alt={recipe.name} className="w-full h-40 object-cover" />
                                <div className="p-5">
                                    <h3 className="text-lg font-semibold mb-2 truncate">{recipe.name}</h3>
                                    <div className="flex justify-between text-sm text-gray-500">
                                        <span>{recipe.prepTime}</span>
                                        <span>{recipe.calories}</span>
                                        <span className={`font-medium ${recipe.difficulty === 'Easy' ? 'text-green-600' : recipe.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-600'}`}>{recipe.difficulty}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {view === 'cooking' && selectedRecipe && (
            <CookingModeView recipe={selectedRecipe} onBack={() => setView('recipes')} onAddToShoppingList={handleAddToShoppingList} identifiedIngredients={identifiedIngredients} />
        )}

        {view === 'shopping' && (
            <div className="w-full max-w-2xl mx-auto p-4 md:p-8 bg-white rounded-2xl shadow-lg h-full flex flex-col">
                <div className="flex items-center mb-6">
                    <button onClick={() => setView('recipes')} className="p-2 rounded-full hover:bg-gray-100 mr-4"><BackIcon className="h-6 w-6" /></button>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex-grow">Shopping List</h2>
                </div>
                {Array.from(shoppingList.values()).length > 0 ? (
                    <ul className="space-y-3">
                        {/* Fix: Explicitly type `item` as `Ingredient` to resolve TypeScript error. */}
                        {Array.from(shoppingList.values()).map((item: Ingredient) => (
                             <li key={item.name} className="flex items-center p-3 bg-gray-50 rounded-lg">
                                 <input id={item.name} type="checkbox" className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-4" />
                                 <label htmlFor={item.name} className="text-gray-800 flex-grow cursor-pointer">
                                     <span className="font-medium">{item.name}</span> <span className="text-gray-500">({item.quantity})</span>
                                 </label>
                             </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-gray-500 py-10">Your shopping list is empty.</p>
                )}
            </div>
        )}

      </main>
    </div>
  );
}
