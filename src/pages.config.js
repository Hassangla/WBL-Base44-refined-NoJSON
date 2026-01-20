import AIComparison from './pages/AIComparison';
import AIRequests from './pages/AIRequests';
import aisettingsCompleteFix from './pages/AISettings-COMPLETE-FIX';
import AISettings from './pages/AISettings';
import AIUsage from './pages/AIUsage';
import AppSettings from './pages/AppSettings';
import BatchDetail from './pages/BatchDetail';
import BatchWizard from './pages/BatchWizard';
import Batches from './pages/Batches';
import Dashboard from './pages/Dashboard';
import Economies from './pages/Economies';
import Exports from './pages/Exports';
import QuestionLibrary from './pages/QuestionLibrary';
import TaskDetail from './pages/TaskDetail';
import Tasks from './pages/Tasks';
import UsersRoles from './pages/UsersRoles';
import ValidatorQueue from './pages/ValidatorQueue';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIComparison": AIComparison,
    "AIRequests": AIRequests,
    "AISettings-COMPLETE-FIX": aisettingsCompleteFix,
    "AISettings": AISettings,
    "AIUsage": AIUsage,
    "AppSettings": AppSettings,
    "BatchDetail": BatchDetail,
    "BatchWizard": BatchWizard,
    "Batches": Batches,
    "Dashboard": Dashboard,
    "Economies": Economies,
    "Exports": Exports,
    "QuestionLibrary": QuestionLibrary,
    "TaskDetail": TaskDetail,
    "Tasks": Tasks,
    "UsersRoles": UsersRoles,
    "ValidatorQueue": ValidatorQueue,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};