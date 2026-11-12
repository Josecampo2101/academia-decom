import type { AssessmentAnswerKey, AssessmentQuestion } from "@/lib/academic/assessment-attempts";

export const practiceQuestions: AssessmentQuestion[] = [
  { id: "single", type: "Selección única", prompt: "¿Qué debe orientar la elección del medio de comunicación?", options: ["La preferencia personal del diseñador", "El propósito y el público del mensaje", "La cantidad de colores disponibles", "La tendencia del momento"] },
  { id: "multiple", type: "Selección múltiple", prompt: "¿Qué acciones ayudan a mantener una comunicación institucional responsable? Selecciona todas las que correspondan.", options: ["Verificar los datos antes de publicar", "Adaptar el lenguaje al público", "Alterar el logotipo para cada publicación", "Revisar el contexto del mensaje"] },
  { id: "boolean", type: "Verdadero o falso", prompt: "La identidad institucional se limita únicamente al uso del logotipo.", options: ["Verdadero", "Falso"] },
  { id: "short", type: "Respuesta corta", prompt: "Menciona dos aspectos que verificarías antes de publicar una comunicación institucional.", options: [] },
];

// CLAVE FICTICIA PARA DEMOSTRACIÓN. Este módulo se importa en cliente y su contenido
// puede inspeccionarse en el bundle; nunca reutilizar esta arquitectura en producción.
export const practiceAnswerKey: AssessmentAnswerKey = {
  single: ["El propósito y el público del mensaje"],
  multiple: ["Verificar los datos antes de publicar", "Adaptar el lenguaje al público", "Revisar el contexto del mensaje"],
  boolean: ["Falso"],
};
