import { GoogleGenAI } from "@google/genai";
import * as z from "zod";

const castingJsonSchema = {
  type: "object",
  properties: {
    performances: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Performance date in YYYY-MM-DD format.",
          },
          weekday: {
            type: "string",
            description: "Weekday in Korean (월, 화, 수, 목, 금, 토, 일).",
          },
          time: {
            type: "string",
            description: "Performance time in HH:mm format.",
          },
          casting: {
            type: "object",
            description: "Role name -> actor name mapping.",
            additionalProperties: {
              type: "string",
            },
          },
        },
        required: ["date", "weekday", "time", "casting"],
      },
    },
  },
  required: ["performances"],
} satisfies z.core.JSONSchema.JSONSchema;

const castingSchema = z.fromJSONSchema(castingJsonSchema);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return new Response("No file provided", {
        status: 400,
      });
    }

    const base64Image = Buffer.from(await file.arrayBuffer()).toString(
      "base64",
    );

    const client = new GoogleGenAI({});

    const prompt = `
Extract the largest casting schedule table from this image.

Rules:
- If no casting table exists, return an empty performances array.
- If multiple tables exist, use only the largest and most complete one.
- Use the role names in the header row as the keys of "casting".
- Make your best guess for ambiguous text.
- Do not invent performances that are not visible.
`;

    const interaction = await client.interactions.create({
      model: "gemini-3.5-flash-lite",
      input: [
        {
          type: "text",
          text: prompt,
        },
        {
          type: "image",
          data: base64Image,
          mime_type: file.type,
        },
      ],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: castingJsonSchema,
      },
    });

    if (!interaction.output_text) {
      return new Response("No response from AI model", {
        status: 500,
      });
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(interaction.output_text);
    } catch {
      console.error(interaction.output_text);

      return new Response("Invalid JSON returned from Gemini", {
        status: 500,
      });
    }

    const result = castingSchema.parse(parsed);

    return Response.json(result);
  } catch (error) {
    console.error(error);

    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Invalid response schema",
          issues: error.issues,
        },
        {
          status: 500,
        },
      );
    }

    return new Response("Internal Server Error", {
      status: 500,
    });
  }
}
