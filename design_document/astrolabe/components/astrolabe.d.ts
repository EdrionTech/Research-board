/** Astrolabe — window.Astrolabe */
type Tone = "star" | "sun" | "nova" | "aurora" | "nebula" | "ink";
type IconName = "planet" | "star" | "stars" | "moon" | "sun" | "eclipse" | "comet" | "galaxy" | "orbit" | "constellation" | "telescope" | "rocket" | "satellite" | "astrolabe" | "compass" | "search" | "settings" | "menu" | "close" | "check" | "plus" | "arrow-right" | "arrow-left" | "chevron-right" | "play" | "pause" | "info" | "warning";
export interface PanelProps { title?: string; coords?: string; halo?: boolean; footer?: React.ReactNode; children?: React.ReactNode; }
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: "solid" | "outline" | "ghost"; tone?: Tone; size?: "sm" | "md" | "lg"; icon?: IconName; orbit?: boolean; }
export interface OrbitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon: IconName; label: string; tone?: Tone; size?: "sm" | "md" | "lg"; }
export interface MoonToggleProps { label?: string; checked?: boolean; defaultChecked?: boolean; onChange?: (on: boolean) => void; disabled?: boolean; }
export interface ConstellationProps { steps: string[]; current: number; label?: string; }
export interface TabsProps { tabs: (string | { label: string; icon?: IconName })[]; value?: number; defaultValue?: number; onChange?: (i: number) => void; id?: string; label?: string; children?: React.ReactNode | ((i: number) => React.ReactNode); }
export interface SpectralTagProps { cls: string; children?: React.ReactNode; }
export interface ReadoutProps { label: string; value: React.ReactNode; unit?: string; caption?: string; tone?: Tone; }
export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; icon?: IconName; hint?: string; error?: string; }
export interface SliderProps { label?: string; tone?: Tone; value?: number; defaultValue?: number; min?: number; max?: number; format?: (v: number) => string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; }
export interface IconProps { name: IconName; size?: number; label?: string; }
