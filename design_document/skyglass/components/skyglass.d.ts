/** Skyglass — window.Skyglass */
type Tone = "blue" | "green" | "aqua" | "red" | "orange" | "glass";
type IconName = "arrow-left" | "arrow-right" | "close" | "minimize" | "maximize" | "check" | "plus" | "play" | "pause" | "next" | "prev" | "shuffle" | "repeat" | "search" | "home" | "heart" | "mail" | "user" | "music" | "settings" | "sun" | "download" | "volume" | "more" | "image";
export interface WindowProps { title: string; icon?: IconName; controls?: ("minimize" | "maximize" | "close")[]; onControl?: (c: string) => void; footer?: React.ReactNode; children?: React.ReactNode; }
export interface GlassPanelProps { title?: string; action?: React.ReactNode; strong?: boolean; children?: React.ReactNode; }
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { tone?: Tone; size?: "sm" | "md" | "lg"; icon?: IconName; }
export interface OrbButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon: IconName; label: string; tone?: Tone; size?: "sm" | "md" | "lg" | "xl"; }
export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; icon?: IconName; hint?: string; error?: string; }
export interface SliderProps { label?: string; value?: number; defaultValue?: number; min?: number; max?: number; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; }
export interface MediaBarProps { title?: string; artist?: string; cover?: string; duration?: number; position?: number; playing?: boolean; onPlayToggle?: (playing: boolean) => void; }
export interface Track { title: string; artist?: string; meta?: React.ReactNode; }
export interface TrackListProps { tracks: Track[]; activeIndex?: number; metaLabel?: string; onSelect?: (i: number) => void; }
export interface AppTileProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon: IconName; label?: string; tone?: Tone; size?: "md" | "lg"; }
export interface ChipProps { icon?: IconName; selected?: boolean; onClick?: () => void; children: React.ReactNode; }
export interface IconProps { name: IconName; size?: number; label?: string; }
export interface IconBadgeProps { name: IconName; tone?: Tone; size?: "sm" | "md" | "lg"; label?: string; }
