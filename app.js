import { z } from "zod";
import "./style.css";

const taskSchema = z
  .object({
    title: z.string().trim().min(3, "Add at least 3 characters to the title.").max(80, "Keep the title under 80 characters."),
    description: z.string().trim().max(240, "Keep the description under 240 characters."),
    priority: z.enum(["Low", "Medium", "High"]),
    dueDate: z.string().refine((value) => {
      if (value === "") return true;
      const date = new Date(`${value}T00:00:00.000Z`);
      return Number.isFinite(date.getTime())
        && date.toISOString().slice(0, 10) === value
        && value >= new Date().toISOString().slice(0, 10);
    }, "Choose today or a future date."),
  })
  .strict();

const initialTasks = [
  {
    title: "Review Q4 product roadmap",
    description: "Align the next release priorities with the product team.",
    priority: "High",
    dueDate: "2026-11-28",
    status: "In progress",
  },
  {
    title: "Prepare customer feedback summary",
    description: "Collect the latest notes and highlight recurring themes.",
    priority: "Medium",
    dueDate: "2026-11-30",
    status: "To do",
  },
  {
    title: "Update onboarding checklist",
    description: "Make the first-week steps easier for new teammates to follow.",
    priority: "Low",
    dueDate: "",
    status: "Done",
  },
];

const app = document.querySelector("#app");
const tasks = [...initialTasks];

const icon = (name, className = "h-5 w-5") => {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/>',
  };
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};

function renderBanner() {
  const configuredMessage = import.meta.env.VITE_SYSTEM_BANNER_MESSAGE;
  const message = configuredMessage === undefined
    ? "All systems operational. Your workspace is ready."
    : configuredMessage.trim();
  const tone = ["info", "success", "warning"].includes(import.meta.env.VITE_SYSTEM_BANNER_TONE)
    ? import.meta.env.VITE_SYSTEM_BANNER_TONE
    : "info";
  if (!message) return "";

  const toneClasses = {
    info: "border-indigo-100 bg-indigo-50 text-indigo-900",
    success: "border-emerald-100 bg-emerald-50 text-emerald-900",
    warning: "border-amber-100 bg-amber-50 text-amber-900",
  };

  return `
    <div class="system-banner flex items-center justify-between gap-3 border-b px-5 py-3 text-sm ${toneClasses[tone]}" role="status">
      <div class="flex items-center gap-2">${icon("sparkle", "h-4 w-4 shrink-0")}<span>${escapeHtml(message)}</span></div>
      <button class="banner-dismiss rounded p-1 opacity-70 hover:opacity-100" type="button" aria-label="Dismiss system message">×</button>
    </div>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function taskCard(task) {
  const priorityClass = {
    High: "bg-rose-50 text-rose-700",
    Medium: "bg-amber-50 text-amber-700",
    Low: "bg-slate-100 text-slate-600",
  }[task.priority];
  const statusClass = task.status === "Done" ? "text-emerald-700" : "text-slate-500";

  const card = document.createElement("article");
  card.className = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";

  const title = document.createElement("h3");
  title.className = "font-semibold text-slate-900";
  title.textContent = task.title;

  const description = document.createElement("p");
  description.className = "mt-1 text-sm leading-6 text-slate-500";
  description.textContent = task.description || "No description added.";

  const metadata = document.createElement("div");
  metadata.className = "mt-4 flex flex-wrap items-center gap-2";
  metadata.innerHTML = `<span class="rounded-full px-2.5 py-1 text-xs font-medium ${priorityClass}">${task.priority} priority</span>
    <span class="text-xs ${statusClass}">${task.status}</span>
    ${task.dueDate ? `<span class="ml-auto flex items-center gap-1 text-xs text-slate-500">${icon("calendar", "h-3.5 w-3.5")}${escapeHtml(formatDate(task.dueDate))}</span>` : ""}`;
  card.append(title, description, metadata);
  return card;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function renderTasks() {
  const taskList = document.querySelector("#task-list");
  const count = document.querySelector("#task-count");
  if (!taskList || !count) return;
  taskList.replaceChildren(...tasks.map(taskCard));
  count.textContent = `${tasks.length} tasks`;
}

app.innerHTML = `
  <div class="min-h-screen">
    ${renderBanner()}
    <header class="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8">
      <a class="flex items-center gap-2.5 font-semibold tracking-tight" href="#" aria-label="PulseWorks AI home">
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white">${icon("sparkle", "h-5 w-5")}</span>
        <span>PulseWorks <span class="text-indigo-600">AI</span></span>
      </a>
      <div class="flex items-center gap-3">
        <span class="hidden text-sm text-slate-500 sm:block">Workspace</span>
        <button class="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100" type="button" aria-label="Notifications">${icon("bell")}</button>
        <div class="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700" aria-label="User avatar">PW</div>
      </div>
    </header>

    <div class="mx-auto flex max-w-[1440px] flex-col md:min-h-[calc(100vh-4rem)] md:flex-row">
      <aside class="border-b border-slate-200 bg-white p-4 md:w-60 md:shrink-0 md:border-b-0 md:border-r md:p-5">
        <p class="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Workspace</p>
        <nav class="flex gap-2 md:flex-col" aria-label="Main navigation">
          <a class="flex items-center gap-3 rounded-lg bg-indigo-50 px-3 py-2.5 text-sm font-medium text-indigo-700" href="#overview" aria-current="page">
            ${icon("grid", "h-4 w-4")} Overview
          </a>
          <a class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50" href="#tasks">
            ${icon("check", "h-4 w-4")} Tasks
          </a>
        </nav>
      </aside>

      <main id="overview" class="min-w-0 flex-1 p-5 md:p-8">
        <div class="mb-6">
          <p id="today-date" class="text-sm text-slate-500"></p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight">Good morning</h1>
          <p class="mt-1 text-sm text-slate-500">Here’s what’s happening in your workspace.</p>
        </div>

        <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section id="tasks" aria-labelledby="tasks-heading">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <h2 id="tasks-heading" class="text-lg font-semibold">Your tasks</h2>
                <p id="task-count" class="mt-0.5 text-sm text-slate-500"></p>
              </div>
              <span class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">All tasks</span>
            </div>
            <div id="task-list" class="space-y-3"></div>
          </section>

          <section class="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="create-heading">
            <div class="mb-5">
              <div class="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-indigo-600">${icon("plus", "h-5 w-5")}</div>
              <h2 id="create-heading" class="text-lg font-semibold">Create a task</h2>
              <p class="mt-1 text-sm text-slate-500">Add a task to your workspace.</p>
            </div>
            <form id="task-form" novalidate>
              <label class="mb-1.5 block text-sm font-medium" for="title">Task title</label>
              <input class="form-control mb-1" id="title" name="title" placeholder="What needs to be done?" maxlength="80" required />
              <p class="field-error mb-4 min-h-4 text-xs text-rose-600" data-error="title"></p>

              <label class="mb-1.5 block text-sm font-medium" for="description">Description <span class="font-normal text-slate-400">(optional)</span></label>
              <textarea class="form-control mb-1 resize-y" id="description" name="description" placeholder="Add a few details..." rows="3" maxlength="240"></textarea>
              <p class="field-error mb-4 min-h-4 text-xs text-rose-600" data-error="description"></p>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-1.5 block text-sm font-medium" for="priority">Priority</label>
                  <select class="form-control" id="priority" name="priority">
                    <option>Low</option>
                    <option selected>Medium</option>
                    <option>High</option>
                  </select>
                </div>
                <div>
                  <label class="mb-1.5 block text-sm font-medium" for="dueDate">Due date</label>
                  <input class="form-control" id="dueDate" name="dueDate" type="date" />
                </div>
              </div>
              <p class="field-error mt-1 min-h-4 text-xs text-rose-600" data-error="dueDate"></p>

              <button class="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2" type="submit">
                ${icon("plus", "h-4 w-4")} Add task
              </button>
              <p id="form-success" class="mt-3 min-h-4 text-center text-xs text-emerald-700" role="status"></p>
            </form>
          </section>
        </div>
      </main>
    </div>
  </div>`;

renderTasks();
document.querySelector("#today-date").textContent = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
}).format(new Date());

document.querySelector(".banner-dismiss")?.addEventListener("click", () => {
  document.querySelector(".system-banner")?.remove();
});

const form = document.querySelector("#task-form");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelectorAll(".field-error").forEach((element) => { element.textContent = ""; });
  document.querySelector("#form-success").textContent = "";

  const data = Object.fromEntries(new FormData(form).entries());
  const result = taskSchema.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      const errorElement = document.querySelector(`[data-error="${field}"]`);
      if (errorElement && !errorElement.textContent) errorElement.textContent = issue.message;
    }
    return;
  }

  tasks.unshift({ ...result.data, status: "To do" });
  renderTasks();
  form.reset();
  document.querySelector("#form-success").textContent = "Task added.";
});
