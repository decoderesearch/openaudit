'use client';

import { createContext, useContext } from 'react';

/** True in a navbar menu: there, a model or method link shows its hover card on its own page too. */
export const CardsHere = createContext(false);

export const useCardsHere = () => useContext(CardsHere);
