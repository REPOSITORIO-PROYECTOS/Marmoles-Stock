# Este archivo contiene la copia de seguridad de los endpoints de logística
# que fueron comentados durante la eliminación del módulo de Producción
# (Trabajo, PiezaTrabajo, AcumuladoProduccion, VisitaTecnica, OrdenProduccion)
#
# Los endpoints de logística dependen completamente de estos modelos eliminados:
# - listar_entregas: requiere Trabajo y PiezaTrabajo
# - actualizar_estado_entrega: requiere Trabajo
# - enviar_feedback_calidad: requiere Trabajo
# - actualizar_direccion_entrega: requiere Trabajo
# - entregar_piezas_listas: requiere Trabajo y PiezaTrabajo
# - sincronizar_listos_entrega: requiere Trabajo

