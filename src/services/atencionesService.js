import { supabase } from '../config/supabase.js'

const textOrNull = (value) => String(value ?? '').trim() || null
const numberOrNull = (value) => value === '' || value == null ? null : Number(value)

export const registrarAtencion = async (payload) => {
  const { data, error } = await supabase.rpc('registrar_atencion', {
    p_tipo_persona: payload.tipo_persona,
    p_nombre_persona: String(payload.nombre_persona || '').trim(),
    p_motivo_atencion: String(payload.motivo_atencion || '').trim(),
    p_atencion_realizada: String(payload.atencion_realizada || '').trim(),
    p_resultado: payload.resultado,
    p_productos: (payload.productos || []).map((item) => ({ producto_id: Number(item.producto_id), lote_id: item.lote_id ? Number(item.lote_id) : null, cantidad: Number(item.cantidad), observaciones: textOrNull(item.observaciones) })),
    p_fecha_hora: payload.fecha_hora,
    p_sede_id: payload.sede_id ? Number(payload.sede_id) : null,
    p_turno_id: payload.turno_id ? Number(payload.turno_id) : null,
    p_monitora_id: payload.monitora_id || null,
    p_identificacion_institucional: textOrNull(payload.identificacion_institucional),
    p_facultad_carrera_departamento: textOrNull(payload.facultad_carrera_departamento),
    p_telefono: textOrNull(payload.telefono),
    p_sintomas_referidos: textOrNull(payload.sintomas_referidos),
    p_presion_arterial: textOrNull(payload.presion_arterial),
    p_temperatura: numberOrNull(payload.temperatura),
    p_frecuencia_cardiaca: numberOrNull(payload.frecuencia_cardiaca),
    p_saturacion_oxigeno: numberOrNull(payload.saturacion_oxigeno),
    p_glucosa: numberOrNull(payload.glucosa),
    p_observaciones: textOrNull(payload.observaciones),
    p_resultado_otro: textOrNull(payload.resultado_otro),
  })
  if (error) throw error
  const record = Array.isArray(data) ? data[0] : data
  if (!record?.id || !record?.codigo) throw new Error('La atención fue procesada, pero no se recibió su código.')
  return { id: record.id, codigo: record.codigo }
}

export const atencionesService = Object.freeze({ registrarAtencion })
