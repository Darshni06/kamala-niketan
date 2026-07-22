export const TEAL  = '#3BBFB2'
export const PEACH = '#E8876A'
export const SLATE = '#2D3748'
export const BG    = '#F0F7F6'

export const LEVEL_COLORS = {
  M:  '#ECC94B',
  A:  '#E8876A',
  R:  '#3BBFB2',
  P:  '#48BB78',
  NA: '#A0AEC0',
}

export const LEVEL_FULL = {
  M:  'Making an effort',
  A:  'Advancing',
  R:  'Reaching milestone',
  P:  'Proficient',
  NA: 'Not Applicable',
}

export const LEVELS = ['M', 'A', 'R', 'P', 'NA']

export const GRADE_BADGE = {
  PreKG: { bg: 'rgba(232,135,106,.15)', color: '#c0623c' },
  LKG:   { bg: 'rgba(59,191,178,.15)',  color: '#2a7a74' },
  UKG:   { bg: 'rgba(100,100,180,.12)', color: '#4a4a9a' },
}

export const CLASSES = [
  'PP1','PP2','PP3','PP4','PP5',
  'PP6','PP7','PP8','PP9','PP10',
]

export const GRADES = ['PreKG', 'LKG', 'UKG']

export const GRAPH_TYPES = [
  { id: 'stacked', icon: '▦', label: 'Stacked Bar'   },
  { id: 'heatmap', icon: '⊞', label: 'Heatmap'       },
  { id: 'line',    icon: '↗', label: 'Progress Line'  },
  { id: 'donut',   icon: '◎', label: 'Donut / Pie'    },
  { id: 'radar',   icon: '✦', label: 'Radar / Spider' },
  { id: 'bubble',  icon: '●', label: 'Bubble Chart'   },
]

export const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; }
body { font-family: 'DM Sans', sans-serif; background: ${BG}; color: ${SLATE}; }
input, select, textarea, button { font-family: 'DM Sans', sans-serif; }

.glass {
  background: rgba(255,255,255,.58);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,.78);
  box-shadow: 0 4px 24px rgba(59,191,178,.08), 0 1px 4px rgba(0,0,0,.04);
}

.sidebar {
  width: 220px; min-height: 100vh; flex-shrink: 0;
  background: linear-gradient(160deg, #2a7a74 0%, #3BBFB2 60%, #4ecdc4 100%);
  display: flex; flex-direction: column;
  box-shadow: 4px 0 24px rgba(59,191,178,.15);
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 10;
}

.main {
  margin-left: 220px; min-height: 100vh; padding: 32px;
  background: ${BG};
  background-image:
    radial-gradient(circle at 80% 10%, rgba(232,135,106,.08) 0%, transparent 50%),
    radial-gradient(circle at 10% 80%, rgba(59,191,178,.08) 0%, transparent 50%);
}

.nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 20px; cursor: pointer; border-radius: 10px; margin: 2px 10px;
  color: rgba(255,255,255,.75); font-size: 14px; font-weight: 500; transition: all .18s;
}
.nav-item:hover  { background: rgba(255,255,255,.15); color: white; }
.nav-item.active { background: rgba(255,255,255,.22); color: white; font-weight: 600; }

.btn-primary {
  background: linear-gradient(135deg, #3BBFB2, #2a9d92); color: white;
  border: none; border-radius: 10px; padding: 10px 20px;
  font-size: 14px; font-weight: 600; cursor: pointer;
  transition: all .18s; box-shadow: 0 2px 8px rgba(59,191,178,.3);
}
.btn-primary:hover    { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(59,191,178,.4); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }

.btn-peach {
  background: linear-gradient(135deg, #E8876A, #d4735a); color: white;
  border: none; border-radius: 10px; padding: 10px 20px;
  font-size: 14px; font-weight: 600; cursor: pointer;
  transition: all .18s; box-shadow: 0 2px 8px rgba(232,135,106,.3);
}
.btn-peach:hover { transform: translateY(-1px); }

.btn-ghost {
  background: transparent; color: #3BBFB2; border: 1.5px solid #3BBFB2;
  border-radius: 10px; padding: 9px 18px;
  font-size: 14px; font-weight: 600; cursor: pointer; transition: all .18s;
}
.btn-ghost:hover { background: rgba(59,191,178,.08); }

.btn-danger {
  background: transparent; color: #E53E3E; border: 1.5px solid #FC8181;
  border-radius: 10px; padding: 7px 14px;
  font-size: 13px; font-weight: 600; cursor: pointer; transition: all .18s;
}
.btn-danger:hover { background: rgba(229,62,62,.06); }

.badge {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: .5px;
}
.badge-PreKG { background: rgba(232,135,106,.15); color: #c0623c; }
.badge-LKG   { background: rgba(59,191,178,.15);  color: #2a7a74; }
.badge-UKG   { background: rgba(100,100,180,.12); color: #4a4a9a; }

.level-pill {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 8px;
  font-size: 12px; font-weight: 800; cursor: pointer; transition: all .18s;
  border: 2px solid transparent;
}
.level-M  { background: rgba(236,201,75,.18);  color: #b7860a; }
.level-A  { background: rgba(232,135,106,.18); color: #c0623c; }
.level-R  { background: rgba(59,191,178,.18);  color: #2a7a74; }
.level-P  { background: rgba(72,187,120,.18);  color: #276749; }
.level-NA { background: rgba(160,174,192,.18); color: #718096; }
.level-sel { transform: scale(1.12); border-color: currentColor; box-shadow: 0 0 0 3px rgba(59,191,178,.18); }

.tab { padding: 8px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all .18s; }
.tab.active { background: #3BBFB2; color: white; }
.tab:not(.active) { color: #718096; }
.tab:not(.active):hover { background: rgba(59,191,178,.08); color: #3BBFB2; }

.term-tab { padding: 6px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all .18s; }
.term-tab.active { background: #E8876A; color: white; }
.term-tab:not(.active) { color: #718096; border: 1.5px solid #E2E8F0; }
.term-tab:not(.active):hover { border-color: #E8876A; color: #E8876A; }

.student-card { border-radius: 14px; padding: 16px; cursor: pointer; transition: all .2s; }
.student-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(59,191,178,.18); }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(45,55,72,.38);
  backdrop-filter: blur(4px); z-index: 100;
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.modal {
  background: white; border-radius: 20px; padding: 32px;
  width: 620px; max-width: 100%; max-height: 92vh; overflow-y: auto;
  box-shadow: 0 20px 60px rgba(45,55,72,.2); animation: slideUp .25s ease;
}
@keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }

.form-label { font-size: 11px; font-weight: 700; color: #718096; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 5px; display: block; }
.form-select, .form-input, .form-textarea {
  width: 100%; border: 1.5px solid #E2E8F0; border-radius: 10px;
  padding: 10px 14px; font-size: 14px; color: #2D3748;
  background: #FAFAFA; transition: border .18s; outline: none;
}
.form-select:focus, .form-input:focus, .form-textarea:focus { border-color: #3BBFB2; background: white; }
.form-select:disabled, .form-input:disabled { opacity: .5; cursor: not-allowed; }

.progress-bar-bg   { height: 6px; background: #EDF2F7; border-radius: 99px; overflow: hidden; }
.progress-bar-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #3BBFB2, #4ecdc4); transition: width .4s; }

.graph-type-btn {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 14px 10px; border-radius: 12px; cursor: pointer; transition: all .18s;
  border: 2px solid #E2E8F0; background: white; font-size: 11px; font-weight: 600; color: #718096;
}
.graph-type-btn:hover  { border-color: #3BBFB2; color: #3BBFB2; }
.graph-type-btn.active { border-color: #3BBFB2; background: rgba(59,191,178,.08); color: #2a7a74; }

.skill-row { display: flex; align-items: center; gap: 8px; padding: 9px 0; border-bottom: 1px solid #F7FAFC; }
.skill-row:last-child { border-bottom: none; }

.ai-note-box {
  background: linear-gradient(135deg, rgba(59,191,178,.06), rgba(232,135,106,.04));
  border: 1.5px solid rgba(59,191,178,.25); border-radius: 12px; padding: 14px 16px; margin-top: 12px;
}

.ai-streaming {
  background: linear-gradient(90deg, #f7fafc, #e6f7f6, #f7fafc);
  background-size: 200% 100%; animation: shimmer 1.6s infinite;
  border-radius: 6px; height: 13px; margin: 5px 0;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.divider { height: 1px; background: #EDF2F7; margin: 14px 0; }
.screen-label { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #E8876A; margin-bottom: 6px; }

.rc-section-header {
  font-weight: 700; font-size: 12px; color: white;
  background: #3BBFB2; padding: 7px 12px; border-radius: 6px 6px 0 0;
}
.rc-table-wrap {
  border: 1px solid #CBD5E0; border-radius: 0 6px 6px 6px;
  overflow: hidden; margin-bottom: 16px;
}
.rc-table-wrap table { width: 100%; border-collapse: collapse; font-size: 12px; }
.rc-table-wrap th, .rc-table-wrap td { border: 1px solid #CBD5E0; padding: 6px 10px; }
.rc-table-wrap th { background: #F7FAFC; font-weight: 700; color: #4A5568; }

.spinner {
  width: 36px; height: 36px; border: 3px solid rgba(59,191,178,.2);
  border-top-color: #3BBFB2; border-radius: 50%; animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.error-box {
  background: rgba(229,62,62,.08); border: 1.5px solid rgba(229,62,62,.3);
  border-radius: 10px; padding: 12px 16px; color: #C53030; font-size: 13px;
}
.success-box {
  background: rgba(72,187,120,.08); border: 1.5px solid rgba(72,187,120,.3);
  border-radius: 10px; padding: 12px 16px; color: #276749; font-size: 13px;
}

@media (max-width: 900px) {
  .sidebar { width: 60px; }
  .sidebar .nav-label, .sidebar .brand-text, .sidebar .user-info { display: none; }
  .main { margin-left: 60px; padding: 20px; }
}
`
