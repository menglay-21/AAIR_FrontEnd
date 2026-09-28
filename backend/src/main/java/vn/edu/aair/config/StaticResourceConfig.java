package vn.edu.aair.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

@Configuration
public class StaticResourceConfig implements WebMvcConfigurer {
    private final String avatarLocation;

    public StaticResourceConfig(@Value("${app.storage.directory:./uploads}") String uploadDirectory) {
        String location = Path.of(uploadDirectory).toAbsolutePath().normalize().resolve("avatars").toUri().toString();
        avatarLocation = location.endsWith("/") ? location : location + "/";
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/avatars/**")
                .addResourceLocations(avatarLocation)
                .setCachePeriod(86400);
    }
}
