import React from 'react';
import { Plus, Tag } from 'lucide-react';
import type { ToastMessage, User } from '../../../types';
import { IngredientModal } from './IngredientModal';
import { IngredientMetricsCards } from './IngredientMetricsCards';
import { IngredientFiltersBar } from './IngredientFiltersBar';
import { IngredientCardGrid } from './IngredientCardGrid';
import { IngredientTable } from './IngredientTable';
import { useIngredientsView } from './hooks/useIngredientsView';
import { StockAdjustmentModal } from '../StockAdjustmentModal';
import { ConfirmDeleteModal } from '../../common/ConfirmDeleteModal';
import { CategoryManagerModal } from '../categories/CategoryManagerModal';

export type StatusFilterType = 'todos' | 'bajo' | 'agotado' | 'comprar';

interface IngredientsViewProps {
  user: User;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  externalFilter?: StatusFilterType;
  onNavigateToShoppingList?: () => void;
}

export const IngredientsView: React.FC<IngredientsViewProps> = ({
  user,
  addToast,
  externalFilter,
  onNavigateToShoppingList,
}) => {
  const {
    ingredients,
    isLoading,
    isAdmin,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    categoryFilters,
    metrics,
    filteredProducts,
    isModalOpen,
    setIsModalOpen,
    isCategoryModalOpen,
    setIsCategoryModalOpen,
    ingredientToEdit,
    setIngredientToEdit,
    ingredientToDelete,
    setIngredientToDelete,
    isDeleting,
    adjustmentTarget,
    setAdjustmentTarget,
    openAdjustmentModal,
    handleConfirmAdjustment,
    handleSaveIngredient,
    handleConfirmDelete,
    resetFilters,
    invalidateInventory,
  } = useIngredientsView({ user, addToast, externalFilter });

  const handleOpenCreateModal = () => {
    setIngredientToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: (typeof ingredients)[number]) => {
    setIngredientToEdit(item);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* 1. Header con título centrado y acogedor */}
      <div className="flex flex-col items-center text-center gap-4 bg-white dark:bg-[#16100E] p-6 sm:p-7 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif tracking-tight text-center">
            Despensa de Ingredientes
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1.5 max-w-lg mx-auto text-center">
            Revisa tus materias primas disponibles y lo que hace falta comprar para la producción de hoy.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#201612] hover:bg-stone-50 dark:hover:bg-[#2C1D18] active:scale-[0.98] text-stone-700 dark:text-stone-300 text-xs sm:text-sm font-semibold shadow-xs transition-all duration-150 cursor-pointer"
              title="Gestionar Categorías"
            >
              <Tag className="w-4 h-4 text-[#8C1F25] dark:text-[#E07A5F]" />
              <span>Categorías</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-btn transition-all duration-150 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Ingrediente</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Resumen visual en 3 estados claros (Semáforo de Despensa) */}
      <IngredientMetricsCards
        metrics={metrics}
        statusFilter={statusFilter}
        filteredCount={filteredProducts.length}
        onFilterChange={setStatusFilter}
      />

      {/* 3. Buscador amplio y selector de categorías con emojis */}
      <IngredientFiltersBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        categoryFilters={categoryFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isAdmin={isAdmin}
        shoppingListBadgeCount={metrics.low + metrics.out}
        onNavigateToShoppingList={onNavigateToShoppingList}
        statusFilter={statusFilter}
        onToggleBuyFilter={() =>
          setStatusFilter(statusFilter === 'comprar' ? 'todos' : 'comprar')
        }
      />

      {/* 4. Lista o Cuadrícula de Ingredientes */}
      {isLoading ? (
        <div className="bg-white dark:bg-[#16100E] p-12 rounded-[24px] border border-[#EADBCE] dark:border-[#35251F] text-center animate-pulse shadow-xs">
          <div className="w-10 h-10 border-3 border-[#8C1F25]/20 border-t-[#8C1F25] rounded-full animate-spin mx-auto mb-3"></div>
          <h3 className="font-bold text-[#1C120D] dark:text-[#FBF4EB] text-sm font-serif">
            Cargando despensa de insumos...
          </h3>
          <p className="text-xs text-[#7C695C] dark:text-[#B39F93] mt-1 max-w-sm mx-auto">
            Sincronizando existencias de materias primas con el almacén central.
          </p>
        </div>
      ) : ingredients.length === 0 ? (
        <div className="bg-white dark:bg-[#16100E] p-12 rounded-[24px] border border-[#EADBCE] dark:border-[#35251F] text-center animate-fade-in shadow-xs">
          <div className="text-4xl mb-3">🧁</div>
          <h3 className="font-bold text-[#1C120D] dark:text-[#FBF4EB] text-base font-serif">
            La despensa está vacía
          </h3>
          <p className="text-xs text-[#7C695C] dark:text-[#B39F93] mt-1 max-w-sm mx-auto">
            Aún no has registrado ingredientes ni materias primas en la base de datos.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2.5 flex-wrap">
            <button
              onClick={() => void invalidateInventory()}
              className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-[#251A15] dark:hover:bg-[#32231D] text-[#1C120D] dark:text-[#FBF4EB] rounded-xl text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-1.5"
              title="Volver a sincronizar insumos con el servidor"
            >
              <span>🔄 Sincronizar despensa</span>
            </button>
            {isAdmin && (
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2.5 bg-[#8C1F25] hover:bg-[#74191E] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-btn transition-colors inline-flex items-center gap-1.5"
              >
                <span>+ Agregar primer ingrediente</span>
              </button>
            )}
          </div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-[#16100E] p-12 rounded-[24px] border border-[#EADBCE] dark:border-[#35251F] text-center animate-fade-in shadow-xs">
          <div className="text-4xl mb-3">🧺</div>
          <h3 className="font-bold text-[#1C120D] dark:text-[#FBF4EB] text-base">
            {statusFilter === 'agotado'
              ? '¡No hay ingredientes agotados!'
              : statusFilter === 'bajo'
              ? '¡No hay ingredientes con stock bajo!'
              : 'No hay ingredientes con este criterio'}
          </h3>
          <p className="text-xs text-[#7C695C] dark:text-[#B39F93] mt-1 max-w-sm mx-auto">
            {statusFilter === 'agotado'
              ? 'Todos tus insumos tienen existencias en despensa.'
              : statusFilter === 'bajo'
              ? 'Tus insumos están por encima del mínimo de seguridad.'
              : 'Intenta limpiar los filtros o buscar con otro término.'}
          </p>
          <button
            onClick={resetFilters}
            className="mt-4 px-4 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-[#251A15] dark:hover:bg-[#32231D] text-[#1C120D] dark:text-[#FBF4EB] rounded-xl text-xs font-semibold cursor-pointer"
          >
            Ver todos los ingredientes
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <IngredientCardGrid
          items={filteredProducts}
          isAdmin={isAdmin}
          onAdjustStock={openAdjustmentModal}
          onEdit={handleOpenEditModal}
          onDelete={setIngredientToDelete}
        />
      ) : (
        <IngredientTable
          items={filteredProducts}
          isAdmin={isAdmin}
          onAdjustStock={openAdjustmentModal}
          onEdit={handleOpenEditModal}
          onDelete={setIngredientToDelete}
        />
      )}

      {/* Modales */}
      <IngredientModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIngredientToEdit(null);
        }}
        onSave={handleSaveIngredient}
        ingredientToEdit={ingredientToEdit}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(ingredientToDelete)}
        title="¿Eliminar ingrediente de la despensa?"
        description={
          ingredientToDelete ? (
            <>
              Estás a punto de quitar{' '}
              <strong className="text-[#1C120D] dark:text-[#FBF4EB] font-bold">
                "{ingredientToDelete.name}"
              </strong>
              . Esta materia prima ya no figurará en la lista de insumos.
            </>
          ) : null
        }
        warningNote={
          ingredientToDelete ? (
            <>
              Cantidad registrada:{' '}
              <span className="font-bold">
                {ingredientToDelete.stock} {ingredientToDelete.unit}
              </span>
              . Si solo se agotó temporalmente, te recomendamos dejar su cantidad en 0 en lugar de eliminarlo.
            </>
          ) : undefined
        }
        confirmLabel="Sí, quitar de la despensa"
        isDeleting={isDeleting}
        onClose={() => !isDeleting && setIngredientToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        type="ingredient"
        onCategoriesChanged={() => void invalidateInventory()}
        addToast={addToast}
      />

      <StockAdjustmentModal
        target={adjustmentTarget}
        onClose={() => setAdjustmentTarget(null)}
        onConfirm={handleConfirmAdjustment}
      />
    </div>
  );
};
