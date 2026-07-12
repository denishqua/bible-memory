import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { PracticePage } from './pages/PracticePage';
import { ProfilePage } from './pages/ProfilePage';
import { AddVersePage } from './pages/AddVersePage';

function PracticePageWithKey() {
  const { collectionId } = useParams<{ collectionId: string }>();
  return <PracticePage key={collectionId} />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/practice/:collectionId" element={<PracticePageWithKey />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/add-verse" element={<AddVersePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
