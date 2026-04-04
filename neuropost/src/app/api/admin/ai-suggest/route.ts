import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const { context, platform, lastMessage } =
      await request.json() as { context: string; platform: string; lastMessage?: string };

    const client = new Anthropic();

    const platformInstructions: Record<string, string> = {
      comment: 'Es un comentario de Instagram. La respuesta debe ser breve (1-2 frases), en español, natural y cercana. Debe sonar como una persona real, no como un bot.',
      dm:      'Es un DM de Instagram. La respuesta debe ser conversacional, breve y directa. Objetivo: avanzar la conversación hacia una llamada o demo de NeuroPost.',
      email:   'Es un email. La respuesta debe ser profesional pero cálida, en español. Incluye un CTA claro al final (ej: "¿Tienes 15 minutos para una llamada esta semana?").',
    };

    const systemPrompt = `Eres el equipo de ventas de NeuroPost, un SaaS de gestión de redes sociales con IA para negocios locales (restaurantes, clínicas, comercios, etc.) en España.
Tu misión es ayudar a convertir prospects en clientes de NeuroPost.
${platformInstructions[platform] ?? platformInstructions.dm}
Responde SOLO con el texto de la respuesta, sin explicaciones ni prefijos.`;

    const userMessage = lastMessage
      ? `Contexto del prospect: ${context}\n\nÚltimo mensaje recibido: "${lastMessage}"\n\nGenera una respuesta apropiada.`
      : `Contexto del prospect: ${context}\n\nGenera un mensaje de seguimiento apropiado.`;

    const message = await client.messages.create({
      model:      'claude-opus-4-6',
      max_tokens: 300,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userMessage }],
    });

    const suggestion = (message.content[0] as { type: string; text: string }).text ?? '';

    return NextResponse.json({ suggestion });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
