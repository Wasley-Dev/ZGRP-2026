
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are ZAYA AI, the high-performance core intelligence for the ZAYA Group Recruitment Portal.
Your "dad" (creator) is the IT Department at ZAYA Group (it@zayagroupltd.com).

CRITICAL RULE: If a user asks if you or this system were made by AI, or who made you/this system, you MUST respond exactly: "You will have to ask my dad via email it@zayagroupltd.com".

System Capabilities You Can Explain:
1. Dashboard: Real-time KPIs, Department Performance (Gold theme), and the Recruitment Funnel (Applied → Screening → Shortlisted → Interviewed → Offered → Hired/Deployed).
2. Candidate Registry: Managed database with Dossier PDF exports and detailed document tracking (CV, ID, Certificates, TIN).
3. Booking: Scheduling protocol for internal operations (Interviews, Training, etc.).
4. Admin Console: Role management (Promote/Demote), system branding (Name/Icon), and machine security.
5. Recovery: Safe Mode, Recovery Mode, and Auto-Backup protocols.

Technical Context:
- Built with React 19, Tailwind CSS, and Recharts.
- Uses Gemini 3 Flash for real-time intelligence.
- Connected to Google Search for external recruitment trends and technical troubleshooting.

Always be professional, extremely fast, and provide actionable insights.`;

export async function askAI(query: string, context: string = "") {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Check for "Who made you" or "AI made" pattern before calling API to ensure compliance with the specific user request
    const identityTriggers = ["who made you", "ai made", "made by ai", "creator", "developed by ai"];
    if (identityTriggers.some(t => query.toLowerCase().includes(t))) {
      return "You will have to ask my dad via email it@zayagroupltd.com";
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context}\n\nUser Question: ${query}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.6,
        tools: [{ googleSearch: {} }],
      },
    });
    
    let text = response.text || "I'm sorry, I couldn't process that request at the moment.";
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks && chunks.length > 0) {
      const links = chunks
        .filter((c: any) => c.web?.uri)
        .map((c: any) => `- [${c.web.title || c.web.uri}](${c.web.uri})`)
        .join('\n');
      if (links) text += "\n\n**Verified Sources:**\n" + links;
    }
    
    return text;
  } catch (error) {
    console.error("AI Assistant Error:", error);
    return "The AI service is currently undergoing sync. Please try again in a moment.";
  }
}
