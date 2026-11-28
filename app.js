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

const externalTaskSchema = z.array(z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  title: z.string().trim().min(1).max(160),
  completed: z.boolean(),
})).max(20);

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
let externalTasks = [];
let externalTasksState = "idle";
let externalTasksError = "";
let bannerDismissed = false;
let compactTasks = false;

const icon = (name, className = "h-5 w-5") => {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/>',
    chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/>',
    settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
  };
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};

function renderBanner() {
  if (bannerDismissed) return "";
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
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function getAllTasks() {
  return [...tasks, ...externalTasks];
}

function taskCard(task) {
  const priorityClass = {
    High: "bg-rose-50 text-rose-700",
    Medium: "bg-amber-50 text-amber-700",
    Low: "bg-slate-100 text-slate-600",
  }[task.priority] || "bg-slate-100 text-slate-600";
  const statusClass = task.status === "Done" ? "text-emerald-700" : "text-slate-500";

  const card = document.createElement("article");
  card.className = `rounded-xl border border-slate-200 bg-white shadow-sm ${compactTasks ? "p-3" : "p-4"}`;

  const title = document.createElement("h3");
  title.className = "font-semibold text-slate-900";
  title.textContent = task.title;

  const description = document.createElement("p");
  description.className = "mt-1 text-sm leading-6 text-slate-500";
  description.textContent = task.description || "No description added.";

  const metadata = document.createElement("div");
  metadata.className = "mt-4 flex flex-wrap items-center gap-2";
  metadata.innerHTML = `<span class="rounded-full px-2.5 py-1 text-xs font-medium ${priorityClass}">${escapeHtml(task.priority)} priority</span>
    <span class="text-xs ${statusClass}">${escapeHtml(task.status)}</span>
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
  taskList.replaceChildren(...getAllTasks().map(taskCard));
  count.textContent = `${getAllTasks().length} tasks`;
}

function apiStatusMessage() {
  if (externalTasksState === "loading") return "Loading sample tasks from the external API...";
  if (externalTasksState === "error") return externalTasksError;
  if (externalTasksState === "success") return `${externalTasks.length} sample tasks loaded from the external API.`;
  return "External sample tasks have not been loaded yet.";
}

function renderTasksPage() {
  return `
    <div class="mb-6">
      <p class="text-sm text-slate-500">${escapeHtml(formatLongDate(new Date()))}</p>
      <h1 class="mt-1 text-2xl font-semibold tracking-tight">Tasks</h1>
      <p class="mt-1 text-sm text-slate-500">Keep your team’s work moving forward.</p>
    </div>
    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="tasks-heading">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h2 id="tasks-heading" class="text-lg font-semibold">Your tasks</h2>
            <p id="task-count" class="mt-0.5 text-sm text-slate-500"></p>
          </div>
          <span class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">All tasks</span>
        </div>
        <p id="api-task-status" class="mb-3 text-sm text-slate-500" role="status" aria-live="polite">${escapeHtml(apiStatusMessage())}</p>
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
    </div>`;
}

function metricCard(title, value, detail, iconName) {
  return `<article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex items-start justify-between">
      <p class="text-sm font-medium text-slate-500">${title}</p>
      <span class="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-indigo-600">${icon(iconName, "h-4 w-4")}</span>
    </div>
    <p class="mt-4 text-3xl font-semibold tracking-tight">${value}</p>
    <p class="mt-1 text-sm text-slate-500">${detail}</p>
  </article>`;
}

function renderAnalyticsPage() {
  const allTasks = getAllTasks();
  const completed = allTasks.filter((task) => task.status === "Done").length;
  const inProgress = allTasks.filter((task) => task.status === "In progress").length;
  const completionRate = allTasks.length ? Math.round((completed / allTasks.length) * 100) : 0;
  const priorityCounts = ["High", "Medium", "Low"].map((priority) => ({
    priority,
    count: allTasks.filter((task) => task.priority === priority).length,
  }));
  const maxPriorityCount = Math.max(1, ...priorityCounts.map(({ count }) => count));

  return `
    <div class="mb-6">
      <p class="text-sm text-slate-500">${escapeHtml(formatLongDate(new Date()))}</p>
      <h1 class="mt-1 text-2xl font-semibold tracking-tight">Analytics</h1>
      <p class="mt-1 text-sm text-slate-500">A snapshot of the work in your workspace.</p>
    </div>
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Task analytics">
      ${metricCard("Total tasks", allTasks.length, `${externalTasks.length} from the sample API`, "grid")}
      ${metricCard("Completed", completed, "Tasks marked done", "check")}
      ${metricCard("In progress", inProgress, "Currently being worked on", "chart")}
      ${metricCard("Completion rate", `${completionRate}%`, "Of all workspace tasks", "sparkle")}
    </section>
    <section class="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="priority-heading">
      <div class="mb-5">
        <h2 id="priority-heading" class="text-lg font-semibold">Tasks by priority</h2>
        <p class="mt-1 text-sm text-slate-500">Distribution across all workspace tasks.</p>
      </div>
      <div class="space-y-5">
        ${priorityCounts.map(({ priority, count }) => `
          <div>
            <div class="mb-2 flex justify-between text-sm"><span class="font-medium">${priority}</span><span class="text-slate-500">${count}</span></div>
            <div class="h-2 overflow-hidden rounded-full bg-slate-100" role="meter" aria-label="${priority} priority tasks" aria-valuemin="0" aria-valuemax="${allTasks.length}" aria-valuenow="${count}">
              <div class="h-full rounded-full bg-indigo-600" style="width: ${allTasks.length ? (count / maxPriorityCount) * 100 : 0}%"></div>
            </div>
          </div>`).join("")}
      </div>
    </section>`;
}

function renderSettingsPage() {
  const apiState = externalTasksState === "success"
    ? "Connected"
    : externalTasksState === "loading"
      ? "Connecting"
      : externalTasksState === "error"
        ? "Connection issue"
        : "Not connected";
  const apiTone = externalTasksState === "success"
    ? "text-emerald-700"
    : externalTasksState === "error"
      ? "text-rose-700"
      : "text-slate-500";

  return `
    <div class="mb-6">
      <p class="text-sm text-slate-500">${escapeHtml(formatLongDate(new Date()))}</p>
      <h1 class="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
      <p class="mt-1 text-sm text-slate-500">Manage your workspace preferences and connections.</p>
    </div>
    <div class="grid max-w-3xl gap-5">
      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="preferences-heading">
        <h2 id="preferences-heading" class="text-lg font-semibold">Task preferences</h2>
        <p class="mt-1 text-sm text-slate-500">Adjust how tasks appear in your workspace.</p>
        <label class="mt-5 flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span class="block text-sm font-medium">Compact task cards</span>
            <span class="mt-1 block text-sm text-slate-500">Use less space for each task in the list.</span>
          </span>
          <input id="compact-tasks" class="h-4 w-4 accent-indigo-600" type="checkbox" ${compactTasks ? "checked" : ""} />
        </label>
      </section>
      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="connection-heading">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="connection-heading" class="text-lg font-semibold">External task feed</h2>
            <p class="mt-1 text-sm text-slate-500">Read-only sample tasks from JSONPlaceholder.</p>
          </div>
          <button id="refresh-api" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" type="button" ${externalTasksState === "loading" ? "disabled" : ""}>
            Refresh feed
          </button>
        </div>
        <p class="mt-4 text-sm ${apiTone}" role="status" aria-live="polite">${escapeHtml(apiState)}${externalTasksState === "success" ? ` · ${externalTasks.length} tasks loaded` : ""}</p>
        ${externalTasksState === "error" ? `<p class="mt-2 text-sm text-rose-700">${escapeHtml(externalTasksError)}</p>` : ""}
        <div class="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          ${icon("shield", "mt-0.5 h-4 w-4 shrink-0 text-emerald-700")}
          <p>This integration uses a fixed HTTPS endpoint, sends no credentials, and validates the response before displaying it.</p>
        </div>
      </section>
    </div>`;
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function render() {
  const page = location.hash.slice(1);
  const routes = {
    tasks: { label: "Tasks", icon: "check", content: renderTasksPage },
    analytics: { label: "Analytics", icon: "chart", content: renderAnalyticsPage },
    settings: { label: "Settings", icon: "settings", content: renderSettingsPage },
  };
  const activePage = routes[page] ? page : "tasks";
  const currentPage = routes[activePage];
  if (!routes[page]) history.replaceState(null, "", "#tasks");

  app.innerHTML = `
    <div class="min-h-screen">
      ${renderBanner()}
      <header class="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8">
        <a class="flex items-center gap-2.5 font-semibold tracking-tight" href="#tasks" aria-label="PulseWorks AI home">
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
            ${Object.entries(routes).map(([route, item]) => `
              <a class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${route === activePage ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}"
                href="#${route}" ${route === activePage ? 'aria-current="page"' : ""}>
                ${icon(item.icon, "h-4 w-4")} ${item.label}
              </a>`).join("")}
          </nav>
        </aside>

        <main class="min-w-0 flex-1 p-5 md:p-8">${currentPage.content()}</main>
      </div>
    </div>`;

  document.querySelector(".banner-dismiss")?.addEventListener("click", () => {
    bannerDismissed = true;
    document.querySelector(".system-banner")?.remove();
  });

  if (activePage === "tasks") {
    renderTasks();
    document.querySelector("#task-form").addEventListener("submit", handleTaskSubmit);
  }

  if (activePage === "settings") {
    document.querySelector("#compact-tasks").addEventListener("change", (event) => {
      compactTasks = event.currentTarget.checked;
    });
    document.querySelector("#refresh-api").addEventListener("click", () => {
      externalTasks = [];
      externalTasksState = "idle";
      externalTasksError = "";
      void loadExternalTasks();
    });
  }

  if (externalTasksState === "idle") void loadExternalTasks();
}

function handleTaskSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
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
}

async function loadExternalTasks() {
  externalTasksState = "loading";
  externalTasksError = "";
  render();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/todos?_limit=8", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      externalTasksError = `The task feed returned HTTP ${response.status}. Please try again.`;
      externalTasksState = "error";
      return;
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      externalTasksError = "The task feed returned an unexpected response type. Please try again.";
      externalTasksState = "error";
      return;
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > 65536) {
      externalTasksError = "The task feed response was larger than expected. Please try again.";
      externalTasksState = "error";
      return;
    }

    const payload = await response.json();
    const result = externalTaskSchema.safeParse(payload);
    if (!result.success) {
      externalTasksError = "The task feed returned data in an unexpected format. Please try again.";
      externalTasksState = "error";
      return;
    }
    externalTasks = result.data.map((task) => ({
      title: task.title,
      description: `Sample task · user ${task.userId}`,
      priority: ["Low", "Medium", "High"][(task.id - 1) % 3],
      dueDate: "",
      status: task.completed ? "Done" : "To do",
    }));
    externalTasksState = "success";
  } catch (error) {
    if (error?.name === "AbortError") {
      externalTasksError = "The task feed timed out. Check your connection and try again.";
    } else if (error instanceof SyntaxError) {
      externalTasksError = "The task feed returned invalid JSON. Please try again.";
    } else {
      externalTasksError = "Could not load the external task feed. Check your connection and try again.";
    }
    externalTasksState = "error";
  } finally {
    clearTimeout(timeoutId);
    render();
  }
}

window.addEventListener("hashchange", render);
render();
