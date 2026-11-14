import type { Category } from '../types';

export const DEFAULT_CATEGORY_ICONS: Record<string, string> = {
  'Harinas y Polvos': '🌾',
  'Lácteos y Huevos': '🥛',
  'Azúcares y Dulces': '🍬',
  'Chocolates y Cacaos': '🍫',
  'Frutas y Esencias': '🍓',
  'Grasas y Aceites': '🧈',
};

/**
 * Obtiene el ícono por defecto correspondiente a una categoría.
 * Busca primero si la categoría existe en backend con ícono asignado,
 * luego en el diccionario estándar y finalmente por palabras clave.
 */
export const getCategoryDefaultIcon = (
  categoryName: string,
  categoriesList?: Category[]
): string => {
  if (!categoryName) return '🌾';

  // 1. Si existe en la lista de categorías del sistema y tiene un icono configurado
  if (categoriesList && categoriesList.length > 0) {
    const found = categoriesList.find(
      (c) => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase()
    );
    if (found?.icon) return found.icon;
  }

  // 2. Coincidencia exacta en el diccionario por defecto
  if (DEFAULT_CATEGORY_ICONS[categoryName]) {
    return DEFAULT_CATEGORY_ICONS[categoryName];
  }

  // 3. Coincidencia inteligente por palabras clave
  const lower = categoryName.toLowerCase();
  if (
    lower.includes('harina') ||
    lower.includes('polvo') ||
    lower.includes('trigo') ||
    lower.includes('cereal') ||
    lower.includes('fécula') ||
    lower.includes('fecula') ||
    lower.includes('almidón') ||
    lower.includes('almidon')
  ) {
    return '🌾';
  }
  if (
    lower.includes('lácteo') ||
    lower.includes('lacteo') ||
    lower.includes('leche') ||
    lower.includes('queso') ||
    lower.includes('crema') ||
    lower.includes('yogur') ||
    lower.includes('manjar')
  ) {
    return '🥛';
  }
  if (lower.includes('huevo') || lower.includes('yema') || lower.includes('clara')) {
    return '🥚';
  }
  if (
    lower.includes('azúcar') ||
    lower.includes('azucar') ||
    lower.includes('dulce') ||
    lower.includes('miel') ||
    lower.includes('caramelo') ||
    lower.includes('sirope') ||
    lower.includes('almíbar') ||
    lower.includes('almibar')
  ) {
    return '🍬';
  }
  if (lower.includes('chocola') || lower.includes('cacao') || lower.includes('cobertura')) {
    return '🍫';
  }
  if (
    lower.includes('fruta') ||
    lower.includes('frutilla') ||
    lower.includes('fresa') ||
    lower.includes('baya') ||
    lower.includes('pulpa') ||
    lower.includes('arándano') ||
    lower.includes('arandano') ||
    lower.includes('frambuesa')
  ) {
    return '🍓';
  }
  if (
    lower.includes('grasa') ||
    lower.includes('aceite') ||
    lower.includes('mantequilla') ||
    lower.includes('manteca') ||
    lower.includes('margarina')
  ) {
    return '🧈';
  }
  if (
    lower.includes('esencia') ||
    lower.includes('aroma') ||
    lower.includes('extracto') ||
    lower.includes('vainilla') ||
    lower.includes('colorante')
  ) {
    return '✨';
  }
  if (
    lower.includes('fruto seco') ||
    lower.includes('nuez') ||
    lower.includes('almendra') ||
    lower.includes('maní') ||
    lower.includes('mani') ||
    lower.includes('pistacho') ||
    lower.includes('semilla')
  ) {
    return '🥜';
  }
  if (
    lower.includes('sal') ||
    lower.includes('condimento') ||
    lower.includes('especia') ||
    lower.includes('canela')
  ) {
    return '🧂';
  }

  return '🌾';
};

