
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { BrowserRouter } from "react-router-dom";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import App from "./App";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <DndProvider backend={HTML5Backend}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </DndProvider>
  </ThemeProvider>
);


