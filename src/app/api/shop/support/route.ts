import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const supportRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
  topic: z.string().min(1),
  message: z.string().trim().min(10).max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = supportRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Dữ liệu gửi lên không hợp lệ.", details: validated.error.format() },
        { status: 400 }
      );
    }

    const { fullName, email, phone, topic, message } = validated.data;

    const ticket = await prisma.supportTicket.create({
      data: {
        fullName,
        email,
        phone,
        topic,
        message,
        status: "OPEN",
      },
    });

    return NextResponse.json(
      { message: "Yêu cầu hỗ trợ đã được ghi nhận.", ticketId: ticket.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("[SupportAPI][POST] Error:", error);
    return NextResponse.json(
      { error: "Nội bộ server gặp lỗi. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
