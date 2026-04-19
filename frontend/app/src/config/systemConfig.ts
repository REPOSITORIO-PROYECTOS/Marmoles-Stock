
/**
 * Configuración global del sistema para controlar la visibilidad de elementos en la UI.
 * Permite cumplir con requisitos de privacidad o simplificación de interfaz sin afectar la lógica interna.
 */
export const SYSTEM_CONFIG = {
  // Controla si se muestran las coordenadas X/Y/Z en los editores de planos y presupuestos
  showAxisCoordinates: false,
  
  // Controla si se muestra el espesor del material en las pantallas de aprobación y listas
  showThicknessInApproval: false,
  
  // Otros parámetros de configuración futura
  debugMode: false
};

/**
 * Hook opcional o función para obtener la configuración (si fuera necesario que sea reactiva en el futuro)
 */
export const getSystemConfig = () => SYSTEM_CONFIG;
