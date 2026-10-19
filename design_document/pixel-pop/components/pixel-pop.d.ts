/** Pixel Pop — window.PixelPop */
type Tone = "teal" | "orange" | "pink" | "lavender" | "green" | "yellow" | "blue";
type IconName = "close" | "minimize" | "maximize" | "check" | "info" | "warning" | "search" | "folder" | "mail" | "heart" | "star" | "sparkle" | "play" | "arrow-left" | "arrow-right" | "cursor";

export interface WindowProps { title: string; tone?: Exclude<Tone, "blue">; icon?: IconName; controls?: ("minimize" | "maximize" | "close")[]; onControl?: (c: string) => void; striped?: boolean; footer?: React.ReactNode; children?: React.ReactNode; }
export interface DialogProps { kind?: "info" | "warning" | "error" | "success"; title?: string; actions?: React.ReactNode; onClose?: () => void; children: React.ReactNode; }
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { tone?: "cream" | "teal" | "orange" | "pink" | "lavender" | "green" | "danger"; size?: "sm" | "md" | "lg"; icon?: IconName; children?: React.ReactNode; }
export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; hint?: string; error?: string; icon?: IconName; multiline?: boolean; }
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> { label: React.ReactNode; }
export interface ProgressBarProps { value: number; segments?: number; label?: string; tone?: "blue" | "green" | "pink" | "orange"; }
export interface SliderProps { label?: string; value?: number; defaultValue?: number; min?: number; max?: number; tone?: "yellow" | "pink" | "blue" | "teal"; knob?: "round" | "square"; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; }
export interface BadgeProps { tone?: Tone; icon?: IconName; children: React.ReactNode; }
export interface SpeechBubbleProps { name?: string; from?: "me" | "them"; tail?: "left" | "right"; children: React.ReactNode; }
export interface PixelIconProps { name: IconName; size?: 16 | 32 | 48; label?: string; }
