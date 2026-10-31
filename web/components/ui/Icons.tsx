/** Decorative stroke icons (always aria-hidden by their container). */
type P = { size?: string };
const base = (size = "1em") => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false });

export const BackIcon = ({ size }: P) => <svg {...base(size)}><path d="M19 12H6M11 6l-6 6 6 6" /></svg>;
export const ChevronLeftIcon = ({ size }: P) => <svg {...base(size)}><path d="M15 18l-6-6 6-6" /></svg>;
export const ChevronRightIcon = ({ size }: P) => <svg {...base(size)}><path d="M9 18l6-6-6-6" /></svg>;
export const MicIcon = ({ size }: P) => <svg {...base(size)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
export const StopIcon = ({ size }: P) => <svg {...base(size)}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>;
export const CameraIcon = ({ size }: P) => <svg {...base(size)}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>;
export const UploadIcon = ({ size }: P) => <svg {...base(size)}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>;
export const SpeakerIcon = ({ size }: P) => <svg {...base(size)}><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></svg>;
export const PlayIcon = ({ size }: P) => <svg {...base(size)}><path d="M7 5v14l12-7z" fill="currentColor" /></svg>;
export const KeyboardIcon = ({ size }: P) => <svg {...base(size)}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></svg>;
export const ShareIcon = ({ size }: P) => <svg {...base(size)}><path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7" /></svg>;
export const HeartIcon = ({ size }: P) => <svg {...base(size)}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>;
export const CopyIcon = ({ size }: P) => <svg {...base(size)}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V4h12" /></svg>;
export const CheckIcon = ({ size }: P) => <svg {...base(size)}><path d="M5 12l5 5 9-10" /></svg>;
export const RefreshIcon = ({ size }: P) => <svg {...base(size)}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>;
export const SparkleIcon = ({ size }: P) => <svg {...base(size)}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>;
export const VideoIcon = ({ size }: P) => <svg {...base(size)}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" /></svg>;
export const MenuIcon = ({ size }: P) => <svg {...base(size)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
