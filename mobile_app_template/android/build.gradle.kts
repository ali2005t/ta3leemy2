allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// Unified Build Directory Logic (Fixed Syntax)
// We avoid complex Provider chaining by strictly setting layout.buildDirectory
rootProject.layout.buildDirectory.set(file("../build"))

subprojects {
    // Set each subproject's build dir to ../../build/<project_name>
    val newSubprojectBuildDir = rootProject.layout.buildDirectory.dir(project.name)
    layout.buildDirectory.set(newSubprojectBuildDir)

    project.evaluationDependsOn(":app")

    // Force specific versions to avoid AndroidX conflicts
    configurations.all {
        resolutionStrategy.eachDependency {
            if (requested.group == "androidx.browser" && requested.name == "browser") {
                useVersion("1.8.0")
            }
            if (requested.group == "androidx.core" && (requested.name == "core" || requested.name == "core-ktx")) {
                useVersion("1.13.1")
            }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}