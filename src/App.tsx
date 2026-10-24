import courseData from "./data/courses.json" with { type: "json" };
import Footer from './Footer.tsx'

function App() {
    const courses = courseData.courses;

    return (
        <main>
            <div>
                <h1>OSU CSE Degree Visualizer</h1>
                <p>Loaded {courses.length} courses successfully.</p>

                <ul>
                    {courses.map((course) => (

                        <li key={course.id}>
                            <strong>{course.id}</strong>: {course.title} ({course.credits} credits)
                        </li>
                    ))}
                </ul>
            </div>

            <Footer />
        </main>
    );
}

export default App
