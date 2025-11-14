import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

// 配置 dayjs 语言
dayjs.locale('zh-cn');

// 页面组件
import IdentityCheckPage from './pages/IdentityCheck';
import EscapeHatchPage from './pages/EscapeHatch';
import IntakeFormPage from './pages/IntakeForm';
import ChatPage from './pages/Chat';
import QueuePage from './pages/Queue';
import TicketChatPage from './pages/TicketChat';

import './App.css';

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/identity-check" replace />} />
          <Route path="/identity-check" element={<IdentityCheckPage />} />
          <Route path="/escape-hatch" element={<EscapeHatchPage />} />
          <Route path="/intake-form" element={<IntakeFormPage />} />
          <Route path="/chat/:sessionId" element={<ChatPage />} />
          <Route path="/queue/:sessionId" element={<QueuePage />} />
          <Route path="/ticket/:token" element={<TicketChatPage />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
