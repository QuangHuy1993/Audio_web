export type RegisterRequestDto = {
  fullName: string;
  email: string;
  password: string;
};

export type RegisterResponseDto = {
  email: string;
  fullName: string;
};

export type VerifyAccountRequestDto = {
  email: string;
  code: string;
};

export type VerifyAccountResponseDto = {
  status: "activated";
};

export type ResendActivationOtpRequestDto = {
  email: string;
};

export type ResendActivationOtpResponseDto = {
  success: boolean;
  message: string;
};

export type ForgotPasswordRequestDto = {
  email: string;
};

export type ForgotPasswordResponseDto = {
  success: boolean;
  message: string;
};

export type ResetPasswordRequestDto = {
  email: string;
  code: string;
  newPassword: string;
};

export type ResetPasswordResponseDto = {
  success: boolean;
};


